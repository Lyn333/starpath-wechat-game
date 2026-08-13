/** 森林寻径：游戏首页保持沉浸，内容管理员通过 /editor 管理关卡。 */
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import GameCanvas from "@/components/GameCanvas";
import { ThemeProvider } from "@/contexts/ThemeContext";
import ErrorBoundary from "@/components/ErrorBoundary";
import LevelEditor from "@/pages/LevelEditor";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";

function Router() {
  return <Switch><Route path="/" component={GameCanvas} /><Route path="/editor" component={LevelEditor} /><Route path="/404" component={NotFound} /><Route component={NotFound} /></Switch>;
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider><Toaster /><Router /></TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
