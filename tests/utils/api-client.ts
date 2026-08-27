/**
 * API testing utilities for E2E tests
 * Provides helpers for API contract validation and request/response handling
 */

import { APIRequestContext, APIResponse } from '@playwright/test';
import { API_ENDPOINTS } from './test-data';

export interface ApiTestContext {
  request: APIRequestContext;
  baseURL: string;
  authToken?: string;
}

export class ApiClient {
  private request: APIRequestContext;
  private baseURL: string;
  private authToken?: string;

  constructor(context: ApiTestContext) {
    this.request = context.request;
    this.baseURL = context.baseURL;
    this.authToken = context.authToken;
  }

  setAuthToken(token: string): void {
    this.authToken = token;
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    if (this.authToken) {
      headers.Authorization = `Bearer ${this.authToken}`;
    }
    return headers;
  }

  async get(endpoint: string, params?: Record<string, string>): Promise<APIResponse> {
    const url = new URL(`${this.baseURL}${endpoint}`);
    if (params) {
      Object.entries(params).forEach(([key, value]) => url.searchParams.append(key, value));
    }
    return this.request.get(url.toString(), { headers: this.getHeaders() });
  }

  async post(endpoint: string, data: unknown): Promise<APIResponse> {
    return this.request.post(`${this.baseURL}${endpoint}`, {
      headers: this.getHeaders(),
      data,
    });
  }

  async put(endpoint: string, data: unknown): Promise<APIResponse> {
    return this.request.put(`${this.baseURL}${endpoint}`, {
      headers: this.getHeaders(),
      data,
    });
  }

  async patch(endpoint: string, data: unknown): Promise<APIResponse> {
    return this.request.patch(`${this.baseURL}${endpoint}`, {
      headers: this.getHeaders(),
      data,
    });
  }

  async delete(endpoint: string): Promise<APIResponse> {
    return this.request.delete(`${this.baseURL}${endpoint}`, {
      headers: this.getHeaders(),
    });
  }

  // Convenience methods for common endpoints
  async login(email: string, password: string): Promise<{ token: string; user: any }> {
    const response = await this.post(API_ENDPOINTS.auth.login, { email, password });
    const body = await response.json();
    if (response.ok() && body.token) {
      this.setAuthToken(body.token);
    }
    return body;
  }

  async register(userData: { email: string; password: string; name: string }): Promise<any> {
    const response = await this.post(API_ENDPOINTS.auth.register, userData);
    return response.json();
  }

  async getWorkouts(): Promise<any> {
    const response = await this.get(API_ENDPOINTS.workouts.list);
    return response.json();
  }

  async createWorkout(workout: any): Promise<any> {
    const response = await this.post(API_ENDPOINTS.workouts.create, workout);
    return response.json();
  }

  async getExercises(search?: string): Promise<any> {
    const response = await this.get(API_ENDPOINTS.exercises.list, search ? { q: search } : undefined);
    return response.json();
  }
}

/**
 * Validate API response against expected schema
 */
export function validateResponse(response: APIResponse, expectedStatus: number): void {
  if (response.status() !== expectedStatus) {
    throw new Error(`Expected status ${expectedStatus}, got ${response.status()}: ${response.statusText()}`);
  }
}

/**
 * Validate response has required fields
 */
export function validateRequiredFields(data: any, fields: string[]): void {
  const missing = fields.filter((field) => !(field in data));
  if (missing.length > 0) {
    throw new Error(`Missing required fields: ${missing.join(', ')}`);
  }
}

/**
 * Validate response matches expected structure (basic contract testing)
 */
export function validateContract(data: any, contract: Record<string, any>): void {
  for (const [key, expectedType] of Object.entries(contract)) {
    if (!(key in data)) {
      throw new Error(`Missing field: ${key}`);
    }
    const actualType = Array.isArray(data[key]) ? 'array' : typeof data[key];
    if (actualType !== expectedType) {
      throw new Error(`Field ${key}: expected ${expectedType}, got ${actualType}`);
    }
  }
}