import React, { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/auth'
import { useTripStore } from '../stores/trips'
import { MapPin, Clock, DollarSign, Car, User, Calendar, ArrowLeft } from 'lucide-react'

export default function PassengerTrips() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { trips, currentTrip, getTrips, subscribeToTrips } = useTripStore()

  useEffect(() => {
    if (user) {
      getTrips(user.id, 'passenger')
      const unsubscribe = subscribeToTrips(user.id, 'passenger')
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
        return '司機已接單'
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/')}
                className="text-blue-600 hover:text-blue-800"
              >
                <ArrowLeft className="w-6 h-6" />
              </button>
              <h1 className="text-2xl font-bold text-gray-900">我的行程</h1>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">{user?.email}</span>
              <button
                onClick={() => navigate('/')}
                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
              >
                返回首頁
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Current Trip */}
        {currentTrip && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">當前行程</h2>
            <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-blue-500">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <Calendar className="w-5 h-5 text-gray-500" />
                  <span className="text-sm text-gray-600">
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
                    <p className="text-sm font-medium text-gray-900">上車地點</p>
                    <p className="text-sm text-gray-600">{currentTrip.pickup_address}</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <MapPin className="w-5 h-5 text-red-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">目的地</p>
                    <p className="text-sm text-gray-600">{currentTrip.dropoff_address}</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                <div className="flex items-center space-x-2">
                  <Car className="w-5 h-5 text-gray-500" />
                  <span className="text-sm text-gray-600">
                    {currentTrip.car_type === 'economy' && '經濟型'}
                    {currentTrip.car_type === 'comfort' && '舒適型'}
                    {currentTrip.car_type === 'business' && '商務型'}
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <DollarSign className="w-5 h-5 text-gray-500" />
                  <span className="text-lg font-bold text-gray-900">
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
              <p className="text-gray-600 mb-4">您還沒有預約過任何行程</p>
              <button
                onClick={() => navigate('/')}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                立即叫車
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