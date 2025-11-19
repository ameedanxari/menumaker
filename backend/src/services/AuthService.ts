import { Repository } from 'typeorm';
import { User } from '../models/User.js';
import { hashPassword, comparePassword } from '../utils/password.js';
import { generateTokens, verifyToken, JWTPayload } from '../utils/jwt.js';
import { AppDataSource } from '../config/database.js';

export class AuthService {
  private userRepository: Repository<User>;

  constructor() {
    this.userRepository = AppDataSource.getRepository(User);
  }

  async signup(email: string, password: string): Promise<{ user: User; tokens: { accessToken: string; refreshToken: string } }> {
    // Check if user already exists
    const existingUser = await this.userRepository.findOne({ where: { email } });

    if (existingUser) {
      const error = new Error('User with this email already exists') as Error & {
        statusCode: number;
        code: string;
      };
      error.statusCode = 409;
      error.code = 'USER_EXISTS';
      throw error;
    }

    // Hash password
    const password_hash = await hashPassword(password);

    // Create user
    const user = this.userRepository.create({
      email,
      password_hash,
    });

    await this.userRepository.save(user);

    // Generate tokens
    const payload: JWTPayload = {
      userId: user.id,
      email: user.email,
    };

    const tokens = generateTokens(payload);

    return { user, tokens };
  }

  async login(email: string, password: string): Promise<{ user: User; tokens: { accessToken: string; refreshToken: string } }> {
    // Find user with business relation
    const user = await this.userRepository.findOne({
      where: { email },
      relations: ['business'],
    });

    if (!user) {
      const error = new Error('Invalid email or password') as Error & {
        statusCode: number;
        code: string;
      };
      error.statusCode = 401;
      error.code = 'INVALID_CREDENTIALS';
      throw error;
    }

    // Verify password
    const isPasswordValid = await comparePassword(password, user.password_hash);

    if (!isPasswordValid) {
      const error = new Error('Invalid email or password') as Error & {
        statusCode: number;
        code: string;
      };
      error.statusCode = 401;
      error.code = 'INVALID_CREDENTIALS';
      throw error;
    }

    // Generate tokens with businessId if available
    const payload: JWTPayload = {
      userId: user.id,
      email: user.email,
      businessId: (user as any).business?.id, // Include businessId if user has a business
    };

    const tokens = generateTokens(payload);

    return { user, tokens };
  }

  async getCurrentUser(userId: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['business'],
    });

    if (!user) {
      const error = new Error('User not found') as Error & {
        statusCode: number;
        code: string;
      };
      error.statusCode = 404;
      error.code = 'USER_NOT_FOUND';
      throw error;
    }

    return user;
  }

  async refreshTokens(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    try {
      const payload = verifyToken(refreshToken) as JWTPayload;

      // Verify user still exists
      const user = await this.userRepository.findOne({
        where: { id: payload.userId },
        relations: ['business'],
      });

      if (!user) {
        throw new Error('User not found');
      }

      // Generate new tokens
      const newPayload: JWTPayload = {
        userId: user.id,
        email: user.email,
        businessId: (user as any).business?.id,
      };

      return generateTokens(newPayload);
    } catch (error) {
      const err = new Error('Invalid refresh token') as Error & {
        statusCode: number;
        code: string;
      };
      err.statusCode = 401;
      err.code = 'INVALID_REFRESH_TOKEN';
      throw err;
    }
  }

  async updateProfile(userId: string, updates: {
    name?: string;
    phone?: string;
    address?: string;
  }): Promise<User> {
    const user = await this.getCurrentUser(userId);

    if (updates.name !== undefined) {
      user.full_name = updates.name;
    }
    if (updates.phone !== undefined) {
      user.phone = updates.phone;
    }
    if (updates.address !== undefined) {
      user.address = updates.address;
    }

    await this.userRepository.save(user);

    return user;
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new Error('User not found');
    }

    // Verify current password
    const isPasswordValid = await comparePassword(currentPassword, user.password_hash);

    if (!isPasswordValid) {
      throw new Error('Current password is incorrect');
    }

    // Hash and save new password
    user.password_hash = await hashPassword(newPassword);
    await this.userRepository.save(user);
  }

  async updateProfilePhoto(userId: string, photoUrl: string): Promise<User> {
    const user = await this.getCurrentUser(userId);

    user.profile_photo_url = photoUrl;
    await this.userRepository.save(user);

    return user;
  }

  async forgotPassword(email: string): Promise<void> {
    // Find user by email
    const user = await this.userRepository.findOne({ where: { email } });

    // Don't reveal if user exists or not for security reasons
    if (!user) {
      return;
    }

    // TODO: In a real implementation, you would:
    // 1. Generate a password reset token
    // 2. Save it to the database with expiration
    // 3. Send an email with the reset link
    // For now, we'll just log it
    console.log(`Password reset requested for user: ${email}`);
  }
}
