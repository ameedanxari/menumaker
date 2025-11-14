import { AuthService } from '../src/services/AuthService';
import { AppDataSource } from '../src/config/database';
import { User } from '../src/models/User';
import bcrypt from 'bcrypt';

// Mock dependencies
jest.mock('../src/config/database', () => ({
  AppDataSource: {
    getRepository: jest.fn(),
  },
}));

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

    (AppDataSource.getRepository as jest.Mock).mockReturnValue(mockUserRepository);
    authService = new AuthService();
  });

  describe('signup', () => {
    it('should create a new user with hashed password', async () => {
      const email = 'test@example.com';
      const password = 'password123';
      const hashedPassword = 'hashed_password';

      mockUserRepository.findOne.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue(hashedPassword);

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

      await expect(authService.signup(email, 'password')).rejects.toThrow('User already exists');
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
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await authService.login(email, password);

      expect(mockUserRepository.findOne).toHaveBeenCalledWith({ where: { email } });
      expect(bcrypt.compare).toHaveBeenCalledWith(password, hashedPassword);
      expect(result.user).toEqual(expect.objectContaining({ email }));
      expect(result.tokens).toHaveProperty('accessToken');
      expect(result.tokens).toHaveProperty('refreshToken');
    });

    it('should throw error for non-existent user', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      await expect(authService.login('nonexistent@example.com', 'password')).rejects.toThrow(
        'Invalid credentials'
      );
    });

    it('should throw error for incorrect password', async () => {
      const mockUser = {
        id: 'user-id',
        email: 'test@example.com',
        password_hash: 'hashed_password',
      };

      mockUserRepository.findOne.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(authService.login('test@example.com', 'wrongpassword')).rejects.toThrow(
        'Invalid credentials'
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

      expect(mockUserRepository.findOne).toHaveBeenCalledWith({ where: { id: 'user-id' } });
      expect(result).toEqual(mockUser);
    });

    it('should throw error for non-existent user', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      await expect(authService.getCurrentUser('nonexistent-id')).rejects.toThrow('User not found');
    });
  });
});
