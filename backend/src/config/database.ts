import { DataSource } from 'typeorm';
import dotenv from 'dotenv';
import { User } from '../models/User.js';
import { Business } from '../models/Business.js';
import { BusinessSettings } from '../models/BusinessSettings.js';
import { Dish } from '../models/Dish.js';
import { DishCategory } from '../models/DishCategory.js';
import { CommonDish } from '../models/CommonDish.js';
import { Menu } from '../models/Menu.js';
import { MenuItem } from '../models/MenuItem.js';
import { Order } from '../models/Order.js';
import { OrderItem } from '../models/OrderItem.js';
import { OrderNotification } from '../models/OrderNotification.js';
import { Payout } from '../models/Payout.js';

dotenv.config();

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  synchronize: false, // Never use in production
  logging: process.env.NODE_ENV === 'development',
  entities: [
    User,
    Business,
    BusinessSettings,
    Dish,
    DishCategory,
    CommonDish,
    Menu,
    MenuItem,
    Order,
    OrderItem,
    OrderNotification,
    Payout,
  ],
  migrations: ['dist/migrations/*.js'],
  subscribers: [],
});
