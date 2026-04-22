import type { ReactNode } from "react";

interface LayoutProps {
  children: ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  return (
    <div className="min-h-screen overflow-hidden px-4 py-8 md:px-8 md:py-12 bg-gradient-to-b from-background to-secondary">
      <div className="max-w-7xl mx-auto">
        <header className="mb-8 text-center">
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-2">
            Flesh & Spirit
          </h1>
          <p className="text-muted-foreground">
            A classic board game with a modern twist
          </p>
        </header>
        <main>{children}</main>
        <footer className="mt-12 text-center text-sm text-muted-foreground">
          <p>
            © {new Date().getFullYear()} Snakes & Ladders. All rights reserved.
          </p>
        </footer>
      </div>
    </div>
  );
};

export default Layout;
