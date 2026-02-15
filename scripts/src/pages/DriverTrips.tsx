import React, { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/auth'
import { useTripStore } from '../stores/trips'
import { MapPin, Clock, DollarSign, Car, User, Calendar, ArrowLeft, Phone, Star } from 'lucide-react'

export default function DriverTrips() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { trips, currentTrip, getTrips, subscribeToTrips } = useTripStore()

  useEffect(() => {
    if (user) {
      getTrips(user.id, 'driver')
      const unsubscribe = subscribeToTrips(user.id, 'driver')
      return unsubscribe
    }
  }, [user])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'requested':
        return 'bg-yellow-100 text-yellow-800'
      case 'accepted':
        return 'bg-blue-100 text-blue-800'
      case 'in_progress':
        return 'bg-green-100 text-green-800'
      case 'completed':
        return 'bg-gray-100 text-gray-800'
      case 'cancelled':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'requested':
        return '等待接單'
      case 'accepted':
        return '已接單'
      case 'in_progress':
        return '行程進行中'
      case 'completed':
        return '已完成'
      case 'cancelled':
        return '已取消'
      default:
        return '未知狀態'
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('zh-TW', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const calculateEarnings = () => {
    return trips
      .filter(trip => trip.status === 'completed' && trip.final_price)
      .reduce((total, trip) => total + (trip.final_price * 0.8), 0) // 80% for driver
  }

  const completedTripsCount = trips.filter(trip => trip.status === 'completed').length

  return (
    <div className="min-h-screen" style={{ background:'#1A1A1A' }}>
      {/* Header */}
      <div className="shadow-sm border-b" style={{ background:'#1A1A1A' }}>
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/driver')}
                className="hover:text-white"
                style={{ color:'#DAA520' }}
              >
                <ArrowLeft className="w-6 h-6" />
              </button>
              <h1 className="text-2xl font-bold" style={{ color:'#DAA520' }}>我的行程</h1>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-sm" style={{ color:'#9ca3af' }}>{user?.email}</span>
              <button
                onClick={() => navigate('/driver')}
                className="text-sm font-medium hover:text-white"
                style={{ color:'#DAA520' }}
              >
                返回首頁
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Earnings Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="rounded-lg shadow-md p-6" style={{ background:'#1A1A1A', border:'1px solid rgba(218,165,32,0.35)' }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium" style={{ color:'#9ca3af' }}>本週收入</p>
                <p className="text-2xl font-bold" style={{ color:'#DAA520' }}>${calculateEarnings().toFixed(2)}</p>
              </div>
              <DollarSign className="w-8 h-8 text-green-600" />
            </div>
          </div>
          <div className="rounded-lg shadow-md p-6" style={{ background:'#1A1A1A', border:'1px solid rgba(218,165,32,0.35)' }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium" style={{ color:'#9ca3af' }}>完成訂單</p>
                <p className="text-2xl font-bold" style={{ color:'#DAA520' }}>{completedTripsCount}</p>
              </div>
              <Car className="w-8 h-8 text-blue-600" />
            </div>
          </div>
          <div className="rounded-lg shadow-md p-6" style={{ background:'#1A1A1A', border:'1px solid rgba(218,165,32,0.35)' }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium" style={{ color:'#9ca3af' }}>平均評分</p>
                <p className="text-2xl font-bold" style={{ color:'#DAA520' }}>4.8</p>
              </div>
              <Star className="w-8 h-8 text-yellow-500" />
            </div>
          </div>
        </div>

        {/* Current Trip */}
        {currentTrip && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4" style={{ color:'#DAA520' }}>當前行程</h2>
            <div className="rounded-lg shadow-md p-6 border-l-4" style={{ background:'#1A1A1A', borderColor:'#3b82f6', borderLeftWidth:4, borderRightWidth:1, borderTopWidth:1, borderBottomWidth:1, borderStyle:'solid', borderRightColor:'rgba(218,165,32,0.35)', borderTopColor:'rgba(218,165,32,0.35)', borderBottomColor:'rgba(218,165,32,0.35)' }}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <Calendar className="w-5 h-5" style={{ color:'#9ca3af' }} />
                  <span className="text-sm" style={{ color:'#9ca3af' }}>
                    {formatDate(currentTrip.created_at)}
                  </span>
                </div>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(currentTrip.status)}`}>
                  {getStatusText(currentTrip.status)}
                </span>
              </div>

              <div className="space-y-3 mb-4">
                <div className="flex items-start space-x-3">
                  <MapPin className="w-5 h-5 text-green-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium" style={{ color:'#DAA520' }}>上車地點</p>
                    <p className="text-sm" style={{ color:'#e5e7eb' }}>{currentTrip.pickup_address}</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <MapPin className="w-5 h-5 text-red-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium" style={{ color:'#DAA520' }}>目的地</p>
                    <p className="text-sm" style={{ color:'#e5e7eb' }}>{currentTrip.dropoff_address}</p>
                  </div>
                </div>
              </div>

              {/* Passenger Info */}
              <div className="rounded-lg p-4 mb-4" style={{ background:'#2A2A2A', border:'1px solid rgba(218,165,32,0.35)' }}>
                <h3 className="text-sm font-medium mb-2" style={{ color:'#DAA520' }}>乘客資訊</h3>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <User className="w-5 h-5" style={{ color:'#9ca3af' }} />
                    <div>
                      <p className="text-sm font-medium" style={{ color:'#e5e7eb' }}>{currentTrip.passenger_name}</p>
                      <p className="text-xs" style={{ color:'#9ca3af' }}>乘客</p>
                    </div>
                  </div>
                  <button className="flex items-center space-x-2 hover:text-white" style={{ color:'#DAA520' }}>
                    <Phone className="w-4 h-4" />
                    <span className="text-sm">聯繫乘客</span>
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4" style={{ borderTop:'1px solid rgba(218,165,32,0.35)' }}>
                <div className="flex items-center space-x-2">
                  <Car className="w-5 h-5" style={{ color:'#9ca3af' }} />
                  <span className="text-sm" style={{ color:'#9ca3af' }}>
                    {currentTrip.car_type === 'economy' && '經濟型'}
                    {currentTrip.car_type === 'comfort' && '舒適型'}
                    {currentTrip.car_type === 'business' && '商務型'}
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <DollarSign className="w-5 h-5" style={{ color:'#9ca3af' }} />
                  <span className="text-lg font-bold" style={{ color:'#DAA520' }}>
                    ${currentTrip.final_price || currentTrip.estimated_price}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Trip History */}
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">歷史行程</h2>
          
          {trips.length === 0 ? (
            <div className="bg-white rounded-lg shadow-md p-8 text-center">
              <Car className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">尚無行程記錄</h3>
              <p className="text-gray-600 mb-4">您還沒有接過任何訂單</p>
              <button
                onClick={() => navigate('/driver')}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                開始接單
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {trips.map((trip) => (
                <div key={trip.id} className="bg-white rounded-lg shadow-md p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-2">
                      <Calendar className="w-5 h-5 text-gray-500" />
                      <span className="text-sm text-gray-600">
                        {formatDate(trip.created_at)}
                      </span>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(trip.status)}`}>
                      {getStatusText(trip.status)}
                    </span>
                  </div>

                  <div className="space-y-3 mb-4">
                    <div className="flex items-start space-x-3">
                      <MapPin className="w-5 h-5 text-green-600 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">上車地點</p>
                        <p className="text-sm text-gray-600">{trip.pickup_address}</p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3">
                      <MapPin className="w-5 h-5 text-red-600 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">目的地</p>
                        <p className="text-sm text-gray-600">{trip.dropoff_address}</p>
                      </div>
                    </div>
                  </div>

                  {/* Passenger Info */}
                  <div className="bg-gray-50 rounded-lg p-3 mb-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <User className="w-4 h-4 text-gray-500" />
                        <span className="text-sm text-gray-900">{trip.passenger_name}</span>
                      </div>
                      {trip.rating && (
                        <div className="flex items-center space-x-1">
                          <Star className="w-4 h-4 text-yellow-500 fill-current" />
                          <span className="text-sm text-gray-600">{trip.rating}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center space-x-1">
                        <Car className="w-4 h-4 text-gray-500" />
                        <span className="text-sm text-gray-600">
                          {trip.car_type === 'economy' && '經濟型'}
                          {trip.car_type === 'comfort' && '舒適型'}
                          {trip.car_type === 'business' && '商務型'}
                        </span>
                      </div>
                      {trip.distance_km && (
                        <div className="flex items-center space-x-1">
                          <Clock className="w-4 h-4 text-gray-500" />
                          <span className="text-sm text-gray-600">
                            {trip.distance_km.toFixed(1)} 公里
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center space-x-1">
                      <DollarSign className="w-4 h-4 text-gray-500" />
                      <span className="font-bold text-gray-900">
                        ${trip.final_price || trip.estimated_price}
                      </span>
                      {trip.status === 'completed' && trip.final_price && (
                        <span className="text-xs text-green-600 ml-1">
                          (+${(trip.final_price * 0.8).toFixed(2)})
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
