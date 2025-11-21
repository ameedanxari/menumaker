import { jest, describe, beforeEach, it, expect } from '@jest/globals';
import { AuthService } from '../src/services/AuthService';
import { AppDataSource } from '../src/config/database';
import { generateTokens } from '../src/utils/jwt';
import bcrypt from 'bcrypt';

// Mock dependencies
jest.mock('../src/config/database');
jest.mock('bcrypt');

describe('AuthService', () => {
  let authService: AuthService;
  let mockUserRepository: any;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Setup mock repository
    mockUserRepository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };

    // Set up the mock implementation
    AppDataSource.getRepository = jest.fn().mockReturnValue(mockUserRepository) as any;

    // Setup bcrypt mocks
    (bcrypt.hash as any) = jest.fn();
    (bcrypt.compare as any) = jest.fn();

    authService = new AuthService();
  });

  describe('signup', () => {
    it('should create a new user with hashed password', async () => {
      const email = 'test@example.com';
      const password = 'password123';
      const hashedPassword = 'hashed_password';

      mockUserRepository.findOne.mockResolvedValue(null);
      (bcrypt.hash as any).mockResolvedValue(hashedPassword);

      const mockUser = {
        id: 'user-id',
        email,
        password_hash: hashedPassword,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockUserRepository.create.mockReturnValue(mockUser);
      mockUserRepository.save.mockResolvedValue(mockUser);

      const result = await authService.signup(email, password);

      expect(mockUserRepository.findOne).toHaveBeenCalledWith({ where: { email } });
      expect(bcrypt.hash).toHaveBeenCalledWith(password, 10);
      expect(mockUserRepository.create).toHaveBeenCalledWith({
        email,
        password_hash: hashedPassword,
      });
      expect(result.user).toEqual(expect.objectContaining({ email }));
      expect(result.tokens).toHaveProperty('accessToken');
      expect(result.tokens).toHaveProperty('refreshToken');
    });

    it('should throw error if user already exists', async () => {
      const email = 'existing@example.com';
      mockUserRepository.findOne.mockResolvedValue({ email });

      await expect(authService.signup(email, 'password')).rejects.toThrow('User with this email already exists');
    });

    it('should throw error for invalid email format', async () => {
      await expect(authService.signup('invalid-email', 'password')).rejects.toThrow();
    });

    it('should throw error for short password', async () => {
      await expect(authService.signup('test@example.com', 'short')).rejects.toThrow();
    });
  });

  describe('login', () => {
    it('should return user and tokens for valid credentials', async () => {
      const email = 'test@example.com';
      const password = 'password123';
      const hashedPassword = 'hashed_password';

      const mockUser = {
        id: 'user-id',
        email,
        password_hash: hashedPassword,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockUserRepository.findOne.mockResolvedValue(mockUser);
      (bcrypt.compare as any).mockResolvedValue(true);

      const result = await authService.login(email, password);

      expect(mockUserRepository.findOne).toHaveBeenCalledWith({
        where: { email },
        relations: ['business'],
      });
      expect(bcrypt.compare).toHaveBeenCalledWith(password, hashedPassword);
      expect(result.user).toEqual(expect.objectContaining({ email }));
      expect(result.tokens).toHaveProperty('accessToken');
      expect(result.tokens).toHaveProperty('refreshToken');
    });

    it('should throw error for non-existent user', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      await expect(authService.login('nonexistent@example.com', 'password')).rejects.toThrow(
        'Invalid email or password'
      );
    });

    it('should throw error for incorrect password', async () => {
      const mockUser = {
        id: 'user-id',
        email: 'test@example.com',
        password_hash: 'hashed_password',
      };

      mockUserRepository.findOne.mockResolvedValue(mockUser);
      (bcrypt.compare as any).mockResolvedValue(false);

      await expect(authService.login('test@example.com', 'wrongpassword')).rejects.toThrow(
        'Invalid email or password'
      );
    });
  });

  describe('getCurrentUser', () => {
    it('should return user for valid user ID', async () => {
      const mockUser = {
        id: 'user-id',
        email: 'test@example.com',
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockUserRepository.findOne.mockResolvedValue(mockUser);

      const result = await authService.getCurrentUser('user-id');

      expect(mockUserRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'user-id' },
        relations: ['business'],
      });
      expect(result).toEqual(mockUser);
    });

    it('should throw error for non-existent user', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      await expect(authService.getCurrentUser('nonexistent-id')).rejects.toThrow('User not found');
    });
  });

  describe('refreshTokens', () => {
    it('should generate new tokens for valid refresh token', async () => {
      const mockUser = {
        id: 'user-id',
        email: 'test@example.com',
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockUserRepository.findOne.mockResolvedValue(mockUser);

      // Generate a real refresh token
      const tokens = generateTokens({
        userId: 'user-id',
        email: 'test@example.com',
      });

      const result = await authService.refreshTokens(tokens.refreshToken);

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result.accessToken).toBeTruthy();
      expect(result.refreshToken).toBeTruthy();
    });

    it('should throw error for invalid refresh token', async () => {
      const invalidToken = 'invalid-token';

      await expect(authService.refreshTokens(invalidToken)).rejects.toThrow('Invalid refresh token');
    });

    it('should throw error if user no longer exists', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      const refreshToken = 'valid-refresh-token';

      await expect(authService.refreshTokens(refreshToken)).rejects.toThrow('Invalid refresh token');
    });
  });

  describe('updateProfile', () => {
    it('should update user name', async () => {
      const mockUser = {
        id: 'user-id',
        email: 'test@example.com',
        full_name: 'Old Name',
        phone: null,
        address: null,
      };

      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockUserRepository.save.mockResolvedValue({ ...mockUser, full_name: 'New Name' });

      const result = await authService.updateProfile('user-id', { name: 'New Name' });

      expect(mockUserRepository.save).toHaveBeenCalled();
      expect(result.full_name).toBe('New Name');
    });

    it('should update user phone', async () => {
      const mockUser = {
        id: 'user-id',
        email: 'test@example.com',
        phone: null,
      };

      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockUserRepository.save.mockResolvedValue({ ...mockUser, phone: '+1234567890' });

      const result = await authService.updateProfile('user-id', { phone: '+1234567890' });

      expect(mockUserRepository.save).toHaveBeenCalled();
      expect(result.phone).toBe('+1234567890');
    });

    it('should update user address', async () => {
      const mockUser = {
        id: 'user-id',
        email: 'test@example.com',
        address: null,
      };

      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockUserRepository.save.mockResolvedValue({ ...mockUser, address: '123 Main St' });

      const result = await authService.updateProfile('user-id', { address: '123 Main St' });

      expect(mockUserRepository.save).toHaveBeenCalled();
      expect(result.address).toBe('123 Main St');
    });

    it('should update multiple fields at once', async () => {
      const mockUser = {
        id: 'user-id',
        email: 'test@example.com',
        full_name: 'Old Name',
        phone: null,
        address: null,
      };

      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockUserRepository.save.mockResolvedValue({
        ...mockUser,
        full_name: 'New Name',
        phone: '+1234567890',
        address: '123 Main St',
      });

      const result = await authService.updateProfile('user-id', {
        name: 'New Name',
        phone: '+1234567890',
        address: '123 Main St',
      });

      expect(mockUserRepository.save).toHaveBeenCalled();
      expect(result.full_name).toBe('New Name');
      expect(result.phone).toBe('+1234567890');
      expect(result.address).toBe('123 Main St');
    });
  });

  describe('changePassword', () => {
    it('should change password for valid current password', async () => {
      const mockUser = {
        id: 'user-id',
        email: 'test@example.com',
        password_hash: 'old-hashed-password',
      };

      mockUserRepository.findOne.mockResolvedValue(mockUser);
      (bcrypt.compare as any).mockResolvedValue(true);
      (bcrypt.hash as any).mockResolvedValue('new-hashed-password');
      mockUserRepository.save.mockResolvedValue({ ...mockUser, password_hash: 'new-hashed-password' });

      await authService.changePassword('user-id', 'oldPassword123', 'newPassword456');

      expect(bcrypt.compare).toHaveBeenCalledWith('oldPassword123', 'old-hashed-password');
      expect(bcrypt.hash).toHaveBeenCalledWith('newPassword456', 10);
      expect(mockUserRepository.save).toHaveBeenCalled();
    });

    it('should throw error for incorrect current password', async () => {
      const mockUser = {
        id: 'user-id',
        email: 'test@example.com',
        password_hash: 'hashed-password',
      };

      mockUserRepository.findOne.mockResolvedValue(mockUser);
      (bcrypt.compare as any).mockResolvedValue(false);

      await expect(
        authService.changePassword('user-id', 'wrongPassword', 'newPassword456')
      ).rejects.toThrow('Current password is incorrect');
    });

    it('should throw error for non-existent user', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      await expect(
        authService.changePassword('nonexistent-id', 'oldPassword', 'newPassword')
      ).rejects.toThrow('User not found');
    });
  });

  describe('updateProfilePhoto', () => {
    it('should update profile photo URL', async () => {
      const mockUser = {
        id: 'user-id',
        email: 'test@example.com',
        profile_photo_url: null,
      };

      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockUserRepository.save.mockResolvedValue({
        ...mockUser,
        profile_photo_url: 'https://example.com/photo.jpg',
      });

      const result = await authService.updateProfilePhoto('user-id', 'https://example.com/photo.jpg');

      expect(mockUserRepository.save).toHaveBeenCalled();
      expect(result.profile_photo_url).toBe('https://example.com/photo.jpg');
    });

    it('should replace existing profile photo', async () => {
      const mockUser = {
        id: 'user-id',
        email: 'test@example.com',
        profile_photo_url: 'https://example.com/old-photo.jpg',
      };

      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockUserRepository.save.mockResolvedValue({
        ...mockUser,
        profile_photo_url: 'https://example.com/new-photo.jpg',
      });

      const result = await authService.updateProfilePhoto('user-id', 'https://example.com/new-photo.jpg');

      expect(result.profile_photo_url).toBe('https://example.com/new-photo.jpg');
    });
  });

  describe('forgotPassword', () => {
    it('should not reveal if user exists', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      await expect(authService.forgotPassword('nonexistent@example.com')).resolves.not.toThrow();
    });

    it('should process password reset for existing user', async () => {
      const mockUser = {
        id: 'user-id',
        email: 'test@example.com',
      };

      mockUserRepository.findOne.mockResolvedValue(mockUser);

      await expect(authService.forgotPassword('test@example.com')).resolves.not.toThrow();
      expect(mockUserRepository.findOne).toHaveBeenCalledWith({ where: { email: 'test@example.com' } });
    });
  });
});
