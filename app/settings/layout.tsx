import MainHeader from '@/components/layout/MainHeader';

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="home-container">
      <MainHeader />
      <div className="home-body">
        <div className="center-panel-container">
          {children}
        </div>
      </div>
    </div>
  );
}
