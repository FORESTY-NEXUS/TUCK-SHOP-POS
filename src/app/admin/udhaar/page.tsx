import UdhaarClient from "./UdhaarClient";
export const dynamic = "force-dynamic";

export default async function UdhaarPage() {
  // Initial data is fetched client-side to keep the component fully interactive.
  // The server component just renders the shell; UdhaarClient fetches on mount.
  return (
    <div className="h-full w-full">
      <UdhaarClient />
    </div>
  );
}
