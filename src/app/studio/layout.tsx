export const metadata = {
  title: "Sanity Studio",
  description: "LibraryNear Sanity Studio",
};

export default function StudioLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <style>{`
        header, footer { display: none !important; }
        body { margin: 0; padding: 0; overflow: hidden; height: 100vh; }
        main { height: 100vh !important; flex: none !important; max-width: 100% !important; margin: 0 !important; padding: 0 !important; }
        #next-studio { height: 100vh !important; }
      `}</style>
      {children}
    </>
  );
}
