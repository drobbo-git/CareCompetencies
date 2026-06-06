import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Home } from "lucide-react";

export default function NotFoundPage() {
  return (
    <div className="max-w-md mx-auto mt-24 text-center space-y-4">
      <h1 className="text-3xl font-semibold">Page not found</h1>
      <p className="text-sm text-muted-foreground">
        The page you're looking for doesn't exist or has been moved.
      </p>
      <Button asChild>
        <Link to="/">
          <Home className="h-4 w-4 mr-2" />
          Back to home
        </Link>
      </Button>
    </div>
  );
}