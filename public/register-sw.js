addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  window.loadgisticInstallPrompt = event;
  dispatchEvent(new Event('loadgistic-install-ready'));
});

const markInstalled = () => {
  delete window.loadgisticInstallPrompt;
  document.documentElement.dataset.pwaInstalled = 'true';
  dispatchEvent(new Event('loadgistic-install-ready'));
};

addEventListener('appinstalled', markInstalled);
if (navigator.standalone || matchMedia('(display-mode: standalone)').matches) markInstalled();

if ('serviceWorker' in navigator && isSecureContext) {
  const register = () => navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).catch(() => {});
  if (document.readyState === 'complete') void register();
  else addEventListener('load', register, { once: true });
}
