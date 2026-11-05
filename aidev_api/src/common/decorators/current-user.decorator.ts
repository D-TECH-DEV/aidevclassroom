import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface RequestWithUser {
  user?: {
    id: number;
    email: string;
    name: string;
    role: string;
    isActive: boolean;
  } | null;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest<RequestWithUser>();
    return req.user ?? null;
  },
);
