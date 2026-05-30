type NavigateFn = (opts: { to: string }) => Promise<void>

let _navigate: NavigateFn | null = null

export function registerNavigate(fn: NavigateFn): void {
  _navigate = fn
}

export function navigateTo(to: string): void {
  if (_navigate) {
    void _navigate({ to })
  } else {
    window.location.href = to
  }
}
