import { supabase } from '../lib/supabaseClient'
import { retry } from './retry'
import type { Database } from '../lib/supabase'

type Payment = Database['public']['Tables']['payments']['Row']

export interface PaymentMethod {
  id: string
  type: 'credit_card' | 'debit_card' | 'cash' | 'bank_transfer'
  last4?: string
  brand?: string
  exp_month?: number
  exp_year?: number
}

export interface PaymentResult {
  success: boolean
  paymentId?: string
  error?: string
}

export const processPayment = async (
  tripId: string,
  amount: number,
  paymentMethod: PaymentMethod
): Promise<PaymentResult> => {
  try {
    if (paymentMethod.type !== 'cash') {
      throw new Error('Only cash payments are allowed')
    }
    const paymentData = {
      trip_id: tripId,
      amount: amount,
      currency: 'TWD',
      payment_method: 'cash',
      status: 'pending',
      processed_at: null
    } as any

    const res0 = await retry(async () =>
      supabase
        .from('payments')
        .insert(paymentData)
        .select()
        .single() as any
    )
    const { data, error } = res0 as any

    if (error) throw error

    return {
      success: true,
      paymentId: data.id
    }
  } catch (error) {
    console.error('Payment processing error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Payment processing failed'
    }
  }
}

export const recordPayment = async (
  tripId: string,
  amount: number,
  method: 'cash' | 'bank_transfer',
  status: 'completed' | 'pending'
): Promise<PaymentResult> => {
  try {
    const paymentData = {
      trip_id: tripId,
      amount,
      currency: 'TWD',
      payment_method: method,
      status,
      processed_at: status === 'completed' ? new Date().toISOString() : null
    } as any
    const res1 = await retry(async () =>
      supabase
        .from('payments')
        .insert(paymentData)
        .select()
        .single() as any
    )
    const { data, error } = res1 as any
    if (error) throw error
    if (error) throw error
    return { success: true, paymentId: data.id }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Record payment failed' }
  }
}

export const confirmPayment = async (tripId: string): Promise<PaymentResult> => {
  try {
    const res3 = await retry(async () =>
      supabase
        .from('payments')
        .select('id, status')
        .eq('trip_id', tripId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single() as any
    )
    const { data: p } = res3 as any
    if (!p?.id) {
      return { success: false, error: 'No payment record found' }
    }
    const res4 = await retry(async () =>
      supabase
        .from('payments')
        .update({ status: 'completed', processed_at: new Date().toISOString() })
        .eq('id', p.id) as any
    )
    const { error: err4 } = res4 as any
    if (err4) throw err4
    return { success: true, paymentId: p.id }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Confirm payment failed' }
  }
}

export const confirmPaymentRPC = async (tripId: string): Promise<PaymentResult> => {
  try {
    const { data, error } = await supabase.rpc('secure_confirm_payment', { p_trip_id: tripId })
    if (error) throw error
    return { success: true, paymentId: (data && data.trip_id) || tripId }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Confirm payment RPC failed' }
  }
}
export const getPaymentMethods = async (userId: string): Promise<PaymentMethod[]> => {
  // Simulate saved payment methods
  return [
    {
      id: 'cash',
      type: 'cash'
    }
  ]
}

export const addPaymentMethod = async (userId: string, paymentMethod: Omit<PaymentMethod, 'id'>): Promise<PaymentMethod> => {
  // Simulate adding payment method
  return {
    id: Math.random().toString(36).substr(2, 9),
    ...paymentMethod
  }
}

export const calculateTripPrice = (basePrice: number, distance: number, duration: number, carType: string): number => {
  // Price calculation based on distance, duration, and car type
  const baseFare = 85 // Base fare in TWD
  const perKmRate = carType === 'economy' ? 15 : carType === 'comfort' ? 20 : 30
  const perMinuteRate = 3
  
  const distanceFare = distance * perKmRate
  const timeFare = duration * perMinuteRate
  
  return Math.round(baseFare + distanceFare + timeFare)
}
