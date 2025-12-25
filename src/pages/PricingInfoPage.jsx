import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { ArrowLeft, Calculator, Car, Truck, UserCheck, Users } from 'lucide-react';

function PricingInfoPage() {
  const navigate = useNavigate();

  const pricingRules = {
    ride: {
      title: '搭車服務',
      icon: Car,
      description: '一般載客服務，適合日常出行',
      baseRules: [
        '基本車賄：70元',
        '距離費用：每公里 15元',
        '時間費用：每分鐘 3元'
      ],
      additionalRules: [
        '超過20公里：每公里額外 10元',
        '5人以上：每多1人加 50元'
      ],
      example: '例：15公里，30分鐘，2人 = 70 + (15×15) + (30×3) = 385元'
    },
    delivery: {
      title: '跑腿服務',
      icon: Truck,
      description: '代購、送物等跑腿服務',
      baseRules: [
        '路程費：每公里 15元',
        '時間費：每分鐘 3元',
        '服務費：100元'
      ],
      additionalRules: [
        '超過20公里：每公里額外 10元',
        '代購費用：另計'
      ],
      example: '例：10公里，20分鐘 + 代購500元 = (10×15) + (20×3) + 100 + 500 = 910元'
    },
    designated_driver: {
      title: '代駕服務',
      icon: UserCheck,
      description: '專業代駕司機服務',
      baseRules: [
        '行程費：(每公里 15元) × 2倍',
        '時間費：(每分鐘 3元) × 2倍',
        '服務費：300元'
      ],
      additionalRules: [
        '超過20公里：(每公里 10元) × 2倍',
        '最低消費：500元'
      ],
      example: '例：15公里，45分鐘 = (15×15×2) + (45×3×2) + 300 = 1020元'
    }
  };

  const ServiceCard = ({ service, data }) => {
    const Icon = data.icon;
    
    return (
      <Card className="glass h-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <Icon className="w-6 h-6 text-primary" />
            {data.title}
          </CardTitle>
          <p className="text-sm text-muted-foreground">{data.description}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-semibold mb-2 text-primary">基本費率</h4>
            <ul className="space-y-1 text-sm">
              {data.baseRules.map((rule, index) => (
                <li key={index} className="flex items-start gap-2">
                  <span className="w-1 h-1 bg-primary rounded-full mt-2 flex-shrink-0"></span>
                  {rule}
                </li>
              ))}
            </ul>
          </div>
          
          <div>
            <h4 className="font-semibold mb-2 text-secondary">額外費用</h4>
            <ul className="space-y-1 text-sm">
              {data.additionalRules.map((rule, index) => (
                <li key={index} className="flex items-start gap-2">
                  <span className="w-1 h-1 bg-secondary rounded-full mt-2 flex-shrink-0"></span>
                  {rule}
                </li>
              ))}
            </ul>
          </div>
          
          <div className="p-3 bg-accent/10 border border-accent/20 rounded-lg">
            <h4 className="font-semibold mb-1 text-accent flex items-center gap-2">
              <Calculator className="w-4 h-4" />
              計算示例
            </h4>
            <p className="text-sm text-accent-foreground">{data.example}</p>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-dark p-4">
      <div className="max-w-6xl mx-auto">
        {/* 頭部導航 */}
        <div className="flex items-center gap-4 mb-8">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => navigate(-1)}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            返回
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-white">費用說明</h1>
            <p className="text-gray-300">書明各種服務的計費方式和標準</p>
          </div>
        </div>

        {/* 服務類型卡片 */}
        <div className="grid lg:grid-cols-3 md:grid-cols-2 gap-6 mb-8">
          {Object.entries(pricingRules).map(([key, data]) => (
            <ServiceCard key={key} service={key} data={data} />
          ))}
        </div>

        {/* 通用規則 */}
        <Card className="glass mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              通用規則說明
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-semibold mb-3 text-primary">乘客數量加費</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between p-2 bg-background/30 rounded">
                    <span>1-4人</span>
                    <span className="text-green-400">免費</span>
                  </div>
                  <div className="flex justify-between p-2 bg-background/30 rounded">
                    <span>5人</span>
                    <span className="text-yellow-400">+50元</span>
                  </div>
                  <div className="flex justify-between p-2 bg-background/30 rounded">
                    <span>6人</span>
                    <span className="text-orange-400">+100元</span>
                  </div>
                  <div className="flex justify-between p-2 bg-background/30 rounded">
                    <span>7人以上</span>
                    <span className="text-red-400">以此類推</span>
                  </div>
                </div>
              </div>
              
              <div>
                <h4 className="font-semibold mb-3 text-secondary">取消費用</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between p-2 bg-background/30 rounded">
                    <span>司機未到達</span>
                    <span className="text-green-400">免費</span>
                  </div>
                  <div className="flex justify-between p-2 bg-background/30 rounded">
                    <span>司機已到達</span>
                    <span className="text-red-400">100元</span>
                  </div>
                </div>
                
                <div className="mt-4 p-3 bg-warning/10 border border-warning/20 rounded">
                  <p className="text-xs text-warning-foreground">
                    ⚠️ 為保障司機權益，司機到達後取消訂單將收取取消費。
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 注意事項 */}
        <Card className="glass">
          <CardHeader>
            <CardTitle>重要提醒</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-3">
                <span className="w-2 h-2 bg-primary rounded-full mt-1.5 flex-shrink-0"></span>
                <p>所有費用為清楚明確的基本資訊，實際費用可能因交通狀況、路線選擇等因素有所調整。</p>
              </div>
              <div className="flex items-start gap-3">
                <span className="w-2 h-2 bg-primary rounded-full mt-1.5 flex-shrink-0"></span>
                <p>跑腿服務的代購費用需另外計算，建議事先與司機確認總費用。</p>
              </div>
              <div className="flex items-start gap-3">
                <span className="w-2 h-2 bg-primary rounded-full mt-1.5 flex-shrink-0"></span>
                <p>所有費用將按照最終實際里程和時間計算，可能與預估費用有些許差異。</p>
              </div>
              <div className="flex items-start gap-3">
                <span className="w-2 h-2 bg-primary rounded-full mt-1.5 flex-shrink-0"></span>
                <p>若有任何費用疑問，請在行程結束後即時聯繫客服或透過問題回報系統反映。</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default PricingInfoPage;