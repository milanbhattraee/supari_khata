"use client";

import * as React from "react";
import { AlertTriangle, Trash2, Info } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "default" | "destructive";
  loading?: boolean;
  onConfirm: () => void;
  onCancel?: () => void;
}

const variantConfig = {
  default: {
    icon: Info,
    iconBg: "bg-primary/10",
    iconColor: "text-primary",
    confirmVariant: "default" as const,
  },
  destructive: {
    icon: Trash2,
    iconBg: "bg-destructive/10",
    iconColor: "text-destructive",
    confirmVariant: "destructive" as const,
  },
};

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const config = variantConfig[variant];
  const Icon = config.icon;

  const handleCancel = () => {
    onCancel?.();
    onOpenChange(false);
  };

  const handleConfirm = () => {
    onConfirm();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="sm:max-w-[380px]">
        <DialogHeader className="items-center text-center">
          <div
            className={cn(
              "mx-auto flex h-12 w-12 items-center justify-center rounded-full",
              config.iconBg
            )}
          >
            <Icon className={cn("h-6 w-6", config.iconColor)} />
          </div>
          <DialogTitle className="text-center">{title}</DialogTitle>
          {description && (
            <DialogDescription className="text-center">
              {description}
            </DialogDescription>
          )}
        </DialogHeader>
        <DialogFooter className="sm:flex-row sm:justify-center gap-3">
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={loading}
            className="flex-1 sm:flex-none sm:min-w-[100px]"
          >
            {cancelLabel}
          </Button>
          <Button
            variant={config.confirmVariant}
            onClick={handleConfirm}
            disabled={loading}
            className="flex-1 sm:flex-none sm:min-w-[100px]"
          >
            {loading ? "Please wait..." : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Hook for easier usage
export function useConfirmDialog() {
  const [state, setState] = React.useState<{
    open: boolean;
    resolve: ((value: boolean) => void) | null;
  }>({
    open: false,
    resolve: null,
  });

  const confirm = React.useCallback(() => {
    return new Promise<boolean>((resolve) => {
      setState({ open: true, resolve });
    });
  }, []);

  const handleConfirm = React.useCallback(() => {
    state.resolve?.(true);
    setState({ open: false, resolve: null });
  }, [state.resolve]);

  const handleCancel = React.useCallback(() => {
    state.resolve?.(false);
    setState({ open: false, resolve: null });
  }, [state.resolve]);

  const handleOpenChange = React.useCallback((open: boolean) => {
    if (!open) {
      state.resolve?.(false);
      setState({ open: false, resolve: null });
    }
  }, [state.resolve]);

  return {
    open: state.open,
    onOpenChange: handleOpenChange,
    onConfirm: handleConfirm,
    onCancel: handleCancel,
    confirm,
  };
}
