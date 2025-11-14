import { Repository } from 'typeorm';
import { User } from '../models/User.js';
import { hashPassword, comparePassword } from '../utils/password.js';
import { generateTokens, JWTPayload } from '../utils/jwt.js';
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
    // Find user
    const user = await this.userRepository.findOne({ where: { email } });

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

    // Generate tokens
    const payload: JWTPayload = {
      userId: user.id,
      email: user.email,
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
}
