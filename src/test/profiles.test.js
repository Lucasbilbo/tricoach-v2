import { describe, it, expect, vi } from 'vitest'
import { getProfile, createProfile } from '../lib/profiles'

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => ({
            data: { id: '123', email: 'test@test.com', plan: 'free' },
            error: null,
          })),
        })),
      })),
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => ({
            data: { id: '123', email: 'test@test.com', plan: 'free' },
            error: null,
          })),
        })),
      })),
    })),
  },
}))

describe('Profiles', () => {
  it('getProfile devuelve el perfil del usuario', async () => {
    const profile = await getProfile('123')
    expect(profile).toBeDefined()
    expect(profile.email).toBe('test@test.com')
    expect(profile.plan).toBe('free')
  })

  it('createProfile crea un perfil con plan free', async () => {
    const profile = await createProfile({ id: '123', email: 'test@test.com' })
    expect(profile).toBeDefined()
    expect(profile.plan).toBe('free')
  })
})