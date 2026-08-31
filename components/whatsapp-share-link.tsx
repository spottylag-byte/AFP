const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export default function WhatsAppShareLink({ path, text }: { path: string; text: string }) {
  const url = `${SITE_URL}${path}`;
  const message = encodeURIComponent(`${text} ${url}`);

  return (
    <a
      href={`https://wa.me/?text=${message}`}
      target="_blank"
      rel="noopener noreferrer"
      className="text-sm underline text-green-700 dark:text-green-500"
    >
      Share via WhatsApp
    </a>
  );
}
