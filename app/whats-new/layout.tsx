import HomeLayout from '../home/layout';

export default function WhatsNewLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <HomeLayout>{children}</HomeLayout>;
}

