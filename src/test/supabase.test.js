import { describe, it, expect } from 'vitest'
import { supabase } from '../lib/supabase'

describe('Conexión Supabase', () => {
  it('el cliente se crea correctamente', () => {
    expect(supabase).toBeDefined()
  })

  it('tiene la URL correcta', () => {
    expect(supabase.supabaseUrl).toBe(import.meta.env.VITE_SUPABASE_URL)
  })
})
