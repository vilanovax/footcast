import {
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import { createHash, randomUUID } from 'node:crypto';
import { getConfig } from '@footcast/config';
import type { Database } from '@footcast/database';
import { DATABASE_TOKEN } from '../database/database.tokens.js';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AuthUserView {
  id: string;
  email: string;
  displayName: string;
  roles: string[];
  permissions: string[];
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(DATABASE_TOKEN) private readonly db: Database,
    private readonly jwtService: JwtService,
  ) {}

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  async validateUser(email: string, password: string): Promise<AuthUserView> {
    const user = await this.db.models.User.findOne({ where: { email } });
    if (!user || !user.getDataValue('isActive')) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const ok = await bcrypt.compare(password, user.getDataValue('passwordHash'));
    if (!ok) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return this.toUserView(user.getDataValue('id'));
  }

  async toUserView(userId: string): Promise<AuthUserView> {
    const user = await this.db.models.User.findByPk(userId, {
      include: [
        {
          association: 'roles',
          include: [{ association: 'permissions' }],
        },
      ],
    });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    const roles =
      (
        user as unknown as {
          roles?: Array<{ name: string; permissions?: Array<{ code: string }> }>;
        }
      ).roles ?? [];
    const roleNames = roles.map((r) => r.name);
    const permissions = Array.from(
      new Set(roles.flatMap((r) => (r.permissions ?? []).map((p) => p.code))),
    );
    return {
      id: user.getDataValue('id'),
      email: user.getDataValue('email'),
      displayName: user.getDataValue('displayName'),
      roles: roleNames,
      permissions,
    };
  }

  async issueTokens(user: AuthUserView): Promise<AuthTokens> {
    const config = getConfig();
    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      email: user.email,
      roles: user.roles,
      permissions: user.permissions,
    });

    const refreshToken = randomUUID() + randomUUID();
    const id = randomUUID();
    const expiresAt = new Date(Date.now() + config.JWT_REFRESH_TTL_SEC * 1000);
    await this.db.models.RefreshToken.create({
      id,
      userId: user.id,
      tokenHash: this.hashToken(refreshToken),
      expiresAt,
      revokedAt: null,
      replacedByTokenId: null,
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: config.JWT_ACCESS_TTL_SEC,
    };
  }

  async login(email: string, password: string): Promise<{ user: AuthUserView; tokens: AuthTokens }> {
    const user = await this.validateUser(email, password);
    const tokens = await this.issueTokens(user);
    return { user, tokens };
  }

  async refresh(refreshToken: string): Promise<AuthTokens> {
    const tokenHash = this.hashToken(refreshToken);
    const stored = await this.db.models.RefreshToken.findOne({ where: { tokenHash } });
    if (!stored || stored.getDataValue('revokedAt')) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    if (stored.getDataValue('expiresAt').getTime() < Date.now()) {
      throw new UnauthorizedException('Refresh token expired');
    }

    const user = await this.toUserView(stored.getDataValue('userId'));
    const tokens = await this.issueTokens(user);

    await stored.update({
      revokedAt: new Date(),
      replacedByTokenId: null,
    });

    return tokens;
  }

  async logout(refreshToken: string): Promise<{ revoked: boolean }> {
    const tokenHash = this.hashToken(refreshToken);
    const stored = await this.db.models.RefreshToken.findOne({ where: { tokenHash } });
    if (!stored) {
      return { revoked: false };
    }
    await stored.update({ revokedAt: new Date() });
    return { revoked: true };
  }
}
