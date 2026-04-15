import { useEffect, useState } from "react";

export default function Toast({ message, onDone }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => { setVisible(false); setTimeout(onDone, 200); }, 2500);
    return () => clearTimeout(t);
  }, [onDone]);

  if (!message) return null;

  return (
    <div className={`fixed bottom-24 md:bottom-6 left-1/2 -translate-x-1/2 z-50
      px-4 py-2 bg-gray-900 text-white text-sm rounded-lg shadow-lg
      transition-opacity duration-200 ${visible ? "opacity-100" : "opacity-0"}`}>
      {message}
    </div>
  );
}
