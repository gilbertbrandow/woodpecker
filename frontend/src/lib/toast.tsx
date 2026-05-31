import { toast as sonner, type ExternalToast } from 'sonner'
import { CheckCircle2, XCircle, AlertTriangle, Info } from 'lucide-react'

type ToastOptions = Omit<ExternalToast, 'icon'>

export const toast = {
  success: (title: string, opts?: ToastOptions) =>
    sonner.success(title, {
      ...opts,
      icon: <CheckCircle2 className="size-4 shrink-0 text-green-600 dark:text-green-400" />,
    }),

  error: (title: string, opts?: ToastOptions) =>
    sonner.error(title, {
      ...opts,
      icon: <XCircle className="size-4 shrink-0 text-red-600 dark:text-red-400" />,
    }),

  warning: (title: string, opts?: ToastOptions) =>
    sonner.warning(title, {
      ...opts,
      icon: <AlertTriangle className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />,
    }),

  info: (title: string, opts?: ToastOptions) =>
    sonner.info(title, {
      ...opts,
      icon: <Info className="size-4 shrink-0 text-blue-600 dark:text-blue-400" />,
    }),

} as const
