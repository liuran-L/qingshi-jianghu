export function useRouter() {
  return {
    push(path: string) { window.history.pushState({}, '', path); },
    replace(path: string) { window.history.replaceState({}, '', path); },
  };
}
