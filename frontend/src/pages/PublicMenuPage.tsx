import { useParams } from 'react-router-dom';

export default function PublicMenuPage() {
  const { businessSlug } = useParams<{ businessSlug: string }>();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto p-4 md:p-8">
        <div className="card">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Public Menu</h1>
          <p className="text-gray-600">
            This is the public menu page for: <span className="font-semibold">{businessSlug}</span>
          </p>
          <p className="text-gray-600 mt-2">
            Customers will be able to view your menu and place orders from this page.
          </p>
        </div>
      </div>
    </div>
  );
}
