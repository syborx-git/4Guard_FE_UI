/**
 * @file non-chat-only.guard.ts
 * @description Guard funcional que impide a usuarios exclusivos de chat (CHAT_ONLY)
 * acceder a rutas operativas bajo el Shell principal, redirigiéndolos a /chat (ADR-022).
 */

import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthState } from '../auth/auth.state';

export const nonChatOnlyGuard: CanActivateFn = () => {
  const authState = inject(AuthState);
  const router = inject(Router);

  if (authState.isChatOnlyUser()) {
    return router.createUrlTree(['/chat']);
  }

  return true;
};
