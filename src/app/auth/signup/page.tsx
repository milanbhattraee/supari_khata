"use client";

import Link from "next/link";
import { useForm } from "react-hook-form";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormDrawerPage } from "@/components/form-drawer-page";
import { signupSchema, SignupFormValues } from "@/app/features/auth /schema";
import { useSignup } from "@/app/features/auth /hooks/useAuth";

export default function SignupPage() {
  const signup = useSignup();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignupFormValues>({
    resolver: standardSchemaResolver(signupSchema),
  });

  const onSubmit = (data: SignupFormValues) => {
    signup.mutate({
      username: data.username,
      email: data.email,
      password: data.password,
    });
  };

  return (
    <FormDrawerPage
      title="सुपारी खाता"
      subtitle="Create your account"
      className="min-h-[62dvh]"
    >
      <div className="mb-5 flex justify-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-[22px] bg-primary/10 backdrop-blur-sm">
          <span className="text-3xl">🥜</span>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <div className="glass-card rounded-2xl p-6 space-y-5">
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              type="text"
              placeholder="admin"
              autoComplete="username"
              className="ios-input"
              {...register("username")}
            />
            {errors.username && (
              <p className="text-xs text-destructive">{errors.username.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com (optional)"
              autoComplete="email"
              className="ios-input"
              {...register("email")}
            />
            {errors.email && (
              <p className="text-xs text-destructive">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="Min 6 characters"
              autoComplete="new-password"
              className="ios-input"
              {...register("password")}
            />
            {errors.password && (
              <p className="text-xs text-destructive">
                {errors.password.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm Password</Label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder="Re-enter password"
              autoComplete="new-password"
              className="ios-input"
              {...register("confirmPassword")}
            />
            {errors.confirmPassword && (
              <p className="text-xs text-destructive">
                {errors.confirmPassword.message}
              </p>
            )}
          </div>

          <Button
            type="submit"
            className="h-11 w-full rounded-xl text-[15px] font-semibold"
            disabled={signup.isPending}
          >
            {signup.isPending ? "Creating account..." : "Create Account"}
          </Button>
        </div>

        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link
            href="/auth/login"
            className="font-medium text-primary hover:underline"
          >
            Sign In
          </Link>
        </p>
      </form>
    </FormDrawerPage>
  );
}
