<<<<<<< HEAD
import * as React from "react";

import { cn } from "@/lib/utils";
=======
import * as React from "react"
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
>>>>>>> 441d1ad2e6f7aa065c38bf9ca9c46dfad7683d47

const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "rounded-lg border bg-card text-card-foreground shadow-sm",
      className
    )}
    {...props}
  />
<<<<<<< HEAD
));
Card.displayName = "Card";
=======
))
Card.displayName = "Card"
>>>>>>> 441d1ad2e6f7aa065c38bf9ca9c46dfad7683d47

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-6", className)}
    {...props}
  />
<<<<<<< HEAD
));
CardHeader.displayName = "CardHeader";
=======
))
CardHeader.displayName = "CardHeader"
>>>>>>> 441d1ad2e6f7aa065c38bf9ca9c46dfad7683d47

const CardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      "text-2xl font-semibold leading-none tracking-tight",
      className
    )}
    {...props}
  />
<<<<<<< HEAD
));
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
CardDescription.displayName = "CardDescription";
=======
))
CardTitle.displayName = "CardTitle"
>>>>>>> 441d1ad2e6f7aa065c38bf9ca9c46dfad7683d47

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
<<<<<<< HEAD
));
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-6 pt-0", className)}
    {...props}
  />
));
CardFooter.displayName = "CardFooter";

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter };
=======
))
CardContent.displayName = "CardContent"

export { Card, CardHeader, CardTitle, CardContent }

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
>>>>>>> 441d1ad2e6f7aa065c38bf9ca9c46dfad7683d47
