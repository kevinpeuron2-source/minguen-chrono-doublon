
export const parseCSV = (text: string): any[] => {
  const lines = text.split('\n').filter(l => l.trim());
  if (lines.length < 1) return [];

  // Détection du séparateur (souvent ; en France, , ailleurs)
  const firstLine = lines[0];
  const commaCount = (firstLine.match(/,/g) || []).length;
  const semiCount = (firstLine.match(/;/g) || []).length;
  const sep = semiCount > commaCount ? ';' : ',';

  // Nettoyage des headers (enlève les guillemets et espaces superflus)
  const headers = lines[0].split(sep).map(h => h.trim().replace(/^["'](.*)["']$/, '$1'));
  
  return lines.slice(1).map(line => {
    const values = line.split(sep).map(v => v.trim().replace(/^["'](.*)["']$/, '$1'));
    return headers.reduce((obj, header, i) => {
      obj[header] = values[i] || '';
      return obj;
    }, {} as any);
  });
};

export const exportToCSV = (filename: string, data: any[]) => {
  if (!data.length) return;
  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(';'), // On utilise ; par défaut pour Excel FR
    ...data.map(row => headers.map(h => `"${row[h] || ''}"`).join(';'))
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
