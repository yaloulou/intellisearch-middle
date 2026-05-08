import { ConflictException, HttpException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import type { Role } from '../common/constants/roles.constant';

// ── Interfaces ──────────────────────────────────────────────────────────────

export interface UserDocument {
  _id: string;
  email: string;
  password_hash: string;
  nom?: string;
  prenom?: string;
  role: Role;
  desk?: string;
  actif: boolean;
  created_at?: string;
  updated_at?: string;
}

export type SafeUser = Omit<UserDocument, 'password_hash'>;

interface EsHit {
  _id: string;
  _source: Omit<UserDocument, '_id'>;
}

interface EsSearchResponse {
  hits?: { total?: { value?: number }; hits?: EsHit[] };
}

interface EsDocResponse {
  _id: string;
  _source?: Omit<UserDocument, '_id'>;
  found?: boolean;
  result?: string;
}

// ── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class UsersService {
  private readonly esBaseUrl = (process.env.ELASTICSEARCH_URL ?? 'http://localhost:9200').replace(/\/+$/, '');
  private readonly esUsername = process.env.ELASTICSEARCH_USERNAME;
  private readonly esPassword = process.env.ELASTICSEARCH_PASSWORD;
  private readonly usersIndex = process.env.ELASTICSEARCH_INDEX_USERS ?? 'users_v1';

  // ── Public methods ────────────────────────────────────────────────────────

  /** Used by AuthService — returns full doc including password_hash */
  async findByEmailWithHash(email: string): Promise<UserDocument | null> {
    const body = { query: { term: { email } }, size: 1 };
    const res = await this.esRequest<EsSearchResponse>(`/${this.usersIndex}/_search`, 'POST', body);
    const hit = res.hits?.hits?.[0];
    if (!hit) return null;
    return { _id: hit._id, ...hit._source };
  }

  /** Returns user profile without password_hash */
  async findById(id: string): Promise<SafeUser | null> {
    const res = await this.esRequest<EsDocResponse>(
      `/${this.usersIndex}/_doc/${encodeURIComponent(id)}`,
      'GET',
    );
    if (res.found === false || !res._source) return null;
    const { password_hash: _, ...safe } = { _id: res._id, ...res._source };
    return safe as SafeUser;
  }

  async findAll(size = 200): Promise<SafeUser[]> {
    const res = await this.esRequest<EsSearchResponse>(`/${this.usersIndex}/_search`, 'POST', {
      size,
      query: { match_all: {} },
      sort: [{ created_at: { order: 'asc' } }],
    });
    return (res.hits?.hits ?? []).map(({ _id, _source }) => {
      const { password_hash: _, ...safe } = { _id, ..._source };
      return safe as SafeUser;
    });
  }

  async createUser(data: {
    email: string;
    password: string;
    nom?: string;
    prenom?: string;
    role: Role;
    desk?: string;
  }): Promise<SafeUser> {
    const existing = await this.findByEmailWithHash(data.email);
    if (existing) {
      throw new ConflictException('Un compte avec cet email existe déjà');
    }

    const password_hash = await bcrypt.hash(data.password, 12);
    const now = new Date().toISOString();
    const doc: Omit<UserDocument, '_id'> = {
      email: data.email.toLowerCase().trim(),
      password_hash,
      nom: data.nom,
      prenom: data.prenom,
      role: data.role,
      desk: data.desk,
      actif: true,
      created_at: now,
      updated_at: now,
    };

    const res = await this.esRequest<EsDocResponse>(`/${this.usersIndex}/_doc`, 'POST', doc);
    const { password_hash: _, ...safe } = { _id: res._id, ...doc };
    return safe as SafeUser;
  }

  async updateUser(
    id: string,
    data: Partial<Pick<UserDocument, 'nom' | 'prenom' | 'role' | 'desk' | 'actif'>>,
  ): Promise<SafeUser> {
    const existing = await this.findById(id);
    if (!existing) throw new NotFoundException('Utilisateur introuvable');

    const update = { ...data, updated_at: new Date().toISOString() };
    await this.esRequest<EsDocResponse>(
      `/${this.usersIndex}/_update/${encodeURIComponent(id)}`,
      'POST',
      { doc: update },
    );

    return (await this.findById(id))!;
  }

  async changePassword(id: string, newPassword: string): Promise<void> {
    const existing = await this.findById(id);
    if (!existing) throw new NotFoundException('Utilisateur introuvable');

    const password_hash = await bcrypt.hash(newPassword, 12);
    await this.esRequest<EsDocResponse>(
      `/${this.usersIndex}/_update/${encodeURIComponent(id)}`,
      'POST',
      { doc: { password_hash, updated_at: new Date().toISOString() } },
    );
  }

  async deactivateUser(id: string): Promise<{ message: string }> {
    const existing = await this.findById(id);
    if (!existing) throw new NotFoundException('Utilisateur introuvable');

    await this.esRequest<EsDocResponse>(
      `/${this.usersIndex}/_update/${encodeURIComponent(id)}`,
      'POST',
      { doc: { actif: false, updated_at: new Date().toISOString() } },
    );
    return { message: 'Utilisateur désactivé' };
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private async esRequest<T>(path: string, method: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (this.esUsername && this.esPassword) {
      headers['Authorization'] = `Basic ${Buffer.from(`${this.esUsername}:${this.esPassword}`).toString('base64')}`;
    }

    let response: Response;
    try {
      response = await fetch(`${this.esBaseUrl}${path}`, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch {
      throw new HttpException('Impossible de joindre Elasticsearch', HttpStatus.BAD_GATEWAY);
    }

    const text = await response.text();
    let parsed: unknown;
    try { parsed = JSON.parse(text); } catch { parsed = { raw: text }; }

    if (!response.ok) {
      const reason = (parsed as Record<string, Record<string, string>>)?.error?.reason ?? response.statusText;
      throw new HttpException(reason, response.status < 500 ? response.status : HttpStatus.BAD_GATEWAY);
    }

    return parsed as T;
  }
}
