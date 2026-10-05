import { HttpException, HttpStatus } from '@nestjs/common';

// Local substitute for search, nested filters, refresh and optimistic concurrency.
// Tests exercise the service and HTTP routes without touching the configured cluster.
export class TestElasticsearch {
  documents = new Map<string, Record<string, any>>();
  versions = new Map<string, number>();
  request = async (path: string, method: string, body?: any): Promise<any> => {
    const url = new URL(path, 'http://test');
    const [index, operation, id] = url.pathname.split('/').slice(1);
    const key = `/${index}/_doc/${id}`;
    if (operation === '_search') {
      const all = [...this.documents].filter(([key]) => key.startsWith(`/${index}/_doc/`));
      const matches = all.filter(([, document]) => this.matches(document, body.query));
      const aggregations: Record<string, any> = {};
      for (const [name, agg] of Object.entries(body.aggs ?? {}) as [string, any][]) {
        const desks = [...new Set(matches.map(([, document]) => document[agg.terms.field]).filter(Boolean))];
        aggregations[name] = { buckets: desks.map(key => ({ key, doc_count: 1 })) };
      }
      return { aggregations, hits: { total: { value: matches.length }, hits: matches.slice(0, body.size ?? 10).map(([key, source]) => ({
        _id: key.split('/').pop(), _source: structuredClone(source), _seq_no: this.versions.get(key) ?? 0, _primary_term: 1,
      })) } };
    }
    const current = this.documents.get(key);
    if (method === 'GET') return { found: !!current, _id: id, _source: current && structuredClone(current), _seq_no: this.versions.get(key) ?? 0, _primary_term: 1 };
    if (url.searchParams.has('if_seq_no') && Number(url.searchParams.get('if_seq_no')) !== (this.versions.get(key) ?? 0)) {
      throw new HttpException('version conflict', HttpStatus.CONFLICT);
    }
    if (operation === '_create' && current) throw new HttpException('already exists', HttpStatus.CONFLICT);
    if (method === 'DELETE') this.documents.delete(key);
    else this.documents.set(key, structuredClone(operation === '_update' ? { ...current, ...body.doc } : body));
    this.versions.set(key, (this.versions.get(key) ?? (current ? 0 : -1)) + 1);
    return { _id: id, result: current ? 'updated' : 'created' };
  };

  private matches(document: any, query: any): boolean {
    if (!query || query.match_all) return true;
    if (query.match_none) return false;
    const values = (field: string) => field.split('.').reduce((value, key) => value?.[key], document);
    if (query.term) return Object.entries(query.term).every(([key, value]) => {
      const actual = values(key); return Array.isArray(actual) ? actual.includes(value) : actual === value;
    });
    if (query.terms) return Object.entries(query.terms).every(([key, value]) => (value as any[]).includes(values(key)));
    if (query.prefix) return Object.entries(query.prefix).every(([key, value]) => String(values(key) ?? '').startsWith(String(value)));
    if (query.nested) return (document[query.nested.path] ?? []).some((item: any) => this.matches({ [query.nested.path]: item }, query.nested.query));
    if (query.bool) {
      const array = (value: any) => value ? (Array.isArray(value) ? value : [value]) : [];
      return [...array(query.bool.filter), ...array(query.bool.must)].every(q => this.matches(document, q)) &&
        array(query.bool.must_not).every(q => !this.matches(document, q));
    }
    throw new Error(`Unsupported test query: ${JSON.stringify(query)}`);
  }
}
