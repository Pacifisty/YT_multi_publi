/**
 * SchemaScript Component
 * Renders JSON-LD structured data as a script tag
 */

interface SchemaScriptProps {
  schema: Record<string, unknown>;
}

export function SchemaScript({ schema }: SchemaScriptProps) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(schema),
      }}
    />
  );
}

export default SchemaScript;
