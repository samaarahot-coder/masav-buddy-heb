import appLogo from '@/assets/app-logo.ico';

export function CreditFooter() {
  return (
    <div className="credit-footer flex flex-col items-center gap-2">
      <div className="flex items-center gap-2">
        <img src={appLogo} alt="SA מערכות" className="h-7 w-7 rounded opacity-70" />
        <div className="text-right">
          <p className="font-medium text-muted-foreground/70">
            תוכנה זו נוצרה על ידי{' '}
            <a href="https://simha.rf.gd" target="_blank" rel="noopener noreferrer" className="font-semibold">
              SA מערכות
            </a>
          </p>
          <p>בניית אתרים • אפליקציות • דפי נחיתה ועוד</p>
        </div>
      </div>
      <a
        href="tel:0533150511"
        className="text-[11px] font-medium bg-primary/5 hover:bg-primary/10 px-3 py-1 rounded-full transition-colors"
      >
        📞 0533150511
      </a>
    </div>
  );
}
