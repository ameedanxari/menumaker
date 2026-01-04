// @vitest-environment jsdom
import { describe, expect, it, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardBody,
  CardFooter,
} from './Card';

describe('Card components', () => {
  afterEach(() => {
    cleanup();
  });
  describe('Card', () => {
    it('renders children', () => {
      render(<Card>Card content</Card>);
      expect(screen.getByText('Card content')).toBeDefined();
    });

    it('applies default variant styles', () => {
      render(<Card data-testid="card">Content</Card>);
      const card = screen.getByTestId('card');
      expect(card.className).toContain('border');
    });

    it('applies elevated variant styles', () => {
      render(
        <Card variant="elevated" data-testid="card">
          Content
        </Card>
      );
      const card = screen.getByTestId('card');
      expect(card.className).toContain('shadow-md');
    });

    it('applies outlined variant styles', () => {
      render(
        <Card variant="outlined" data-testid="card">
          Content
        </Card>
      );
      const card = screen.getByTestId('card');
      expect(card.className).toContain('border-2');
    });

    it('applies interactive styles when interactive', () => {
      render(
        <Card interactive data-testid="card">
          Content
        </Card>
      );
      const card = screen.getByTestId('card');
      expect(card.className).toContain('cursor-pointer');
      expect(card.className).toContain('hover:shadow-lg');
    });

    it('merges custom className', () => {
      render(
        <Card className="custom-class" data-testid="card">
          Content
        </Card>
      );
      const card = screen.getByTestId('card');
      expect(card.className).toContain('custom-class');
    });
  });

  describe('CardHeader', () => {
    it('renders children', () => {
      render(<CardHeader>Header content</CardHeader>);
      expect(screen.getByText('Header content')).toBeDefined();
    });

    it('applies padding styles', () => {
      render(<CardHeader data-testid="header">Content</CardHeader>);
      const header = screen.getByTestId('header');
      expect(header.className).toContain('p-6');
    });
  });

  describe('CardTitle', () => {
    it('renders as h3 element', () => {
      render(<CardTitle>Title</CardTitle>);
      expect(screen.getByRole('heading', { level: 3 })).toBeDefined();
    });

    it('renders children', () => {
      render(<CardTitle>Card Title</CardTitle>);
      expect(screen.getByText('Card Title')).toBeDefined();
    });

    it('applies text styles', () => {
      render(<CardTitle data-testid="title">Title</CardTitle>);
      const title = screen.getByTestId('title');
      expect(title.className).toContain('text-2xl');
      expect(title.className).toContain('font-semibold');
    });
  });

  describe('CardDescription', () => {
    it('renders children', () => {
      render(<CardDescription>Description text</CardDescription>);
      expect(screen.getByText('Description text')).toBeDefined();
    });

    it('applies text styles', () => {
      render(<CardDescription data-testid="desc">Description</CardDescription>);
      const desc = screen.getByTestId('desc');
      expect(desc.className).toContain('text-sm');
      expect(desc.className).toContain('text-neutral-500');
    });
  });

  describe('CardBody', () => {
    it('renders children', () => {
      render(<CardBody>Body content</CardBody>);
      expect(screen.getByText('Body content')).toBeDefined();
    });

    it('applies padding styles', () => {
      render(<CardBody data-testid="body">Content</CardBody>);
      const body = screen.getByTestId('body');
      expect(body.className).toContain('p-6');
      expect(body.className).toContain('pt-0');
    });
  });

  describe('CardFooter', () => {
    it('renders children', () => {
      render(<CardFooter>Footer content</CardFooter>);
      expect(screen.getByText('Footer content')).toBeDefined();
    });

    it('applies flex and padding styles', () => {
      render(<CardFooter data-testid="footer">Content</CardFooter>);
      const footer = screen.getByTestId('footer');
      expect(footer.className).toContain('flex');
      expect(footer.className).toContain('items-center');
      expect(footer.className).toContain('p-6');
    });
  });

  describe('Card composition', () => {
    it('renders complete card structure', () => {
      render(
        <Card data-testid="card">
          <CardHeader>
            <CardTitle>Test Card</CardTitle>
            <CardDescription>A test description</CardDescription>
          </CardHeader>
          <CardBody>Main content here</CardBody>
          <CardFooter>Footer actions</CardFooter>
        </Card>
      );

      expect(screen.getByTestId('card')).toBeDefined();
      expect(screen.getByText('Test Card')).toBeDefined();
      expect(screen.getByText('A test description')).toBeDefined();
      expect(screen.getByText('Main content here')).toBeDefined();
      expect(screen.getByText('Footer actions')).toBeDefined();
    });
  });
});
