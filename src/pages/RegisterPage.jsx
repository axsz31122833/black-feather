import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { useToast } from '../hooks/use-toast';
import { UserPlus, Phone, User, Car, MessageSquare } from 'lucide-react';
import invokeWithAuth from '../lib/functions';
import taxiApi from '../lib/taxi-api-client';
// 已�����09�x+� 碼註� `�:Firebase OTP 流�9移�"�
import { useApp } from '../contexts/AppContext';

function RegisterPage() {
  const [formData, setFormData] = useState({
    
    phone: '',
    name: '',
    role: 'passenger',
    nickname: '',
    carPlate: '',
    remarks: '',
    password: '',
    confirmPassword: '',
    remember: true,
    inviteCode: ''
  });
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { loginUser } = useApp();

  const handleRegister = async (e) => {
    e.preventDefault();
    
    if (!formData.phone.trim() || !formData.name.trim()) {
      toast({ title: '注册成功', description: `欢迎，${userData.name}！`, variant: 'default' });
      return;
    }

    if (formData.role === 'driver' && (!formData.nickname.trim() || !formData.carPlate.trim())) {
      toast({ title: '注册失败', description: error.message || '请稍后再试', variant: 'destructive' });
      return;
    }

    if (!formData.password.trim() || formData.password.length < 6) {
      toast({ title: '輸�&��R�誤', description: '�9設�a�!�� 6 位�"�� 碼', variant: 'destructive' });
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      toast({ title: '� 碼不丬�!�', description: '�9確認�&�次輸�&��a� 碼�:��R', variant: 'destructive' });
      return;
    }

    if (formData.role !== 'super_admin' && !formData.inviteCode.trim()) { 
      toast({ title: '注册失败', description: '请输入邀请码', variant: 'destructive' }); 
      return; 
    } 
        // 规则验证：司机仅限指定手机号；司机邀请码限定；乘客需验证已开通
    const phone = (formData.phone || '').trim();
    const roleCur = (formData.role || 'passenger');
    const invite = (formData.inviteCode || '').trim();
    const allowedAdminPhones = ['0971827628', '0982214855'];
    if (roleCur === 'driver' && !allowedAdminPhones.includes(phone)) {
      toast({ title: '注册失败', description: '内测司机仅限指定手机号：0971827628 或 0982214855', variant: 'destructive' });
      return;
    }
    if (roleCur === 'driver' && !(invite === '0971827628' || invite === '0982214855')) {
      toast({ title: '注册失败', description: '司机邀请码仅限 0971827628 或 0982214855', variant: 'destructive' });
      return;
    }
    if (roleCur === 'passenger') {
      try {
        const vRes = await invokeWithAuth('verify-phone', { phone });
        if (!(vRes && (vRes.success === true || vRes.exists === true))) {
          toast({ title: '注册失败', description: '该手机号尚未在系统开通，请联系管理员', variant: 'destructive' });
          return;
        }
      } catch (_) {
        toast({ title: '注册失败', description: '无法验证手机号，请稍后再试', variant: 'destructive' });
        return;
      }
    }
    setLoading(true); 
    try {
      const roleToSend = (['0971827628','0982214855'].includes((formData.phone||'').trim())) ? 'super_admin' : formData.role;
      const res = await invokeWithAuth('user-register', {
        phone: formData.phone,
        name: formData.name,
        role: roleToSend,
        password: formData.password,
        remember: formData.remember,
        nickname: formData.nickname,
        carPlate: formData.carPlate,
        remarks: formData.remarks,
        inviteCode: formData.inviteCode
      });
      if (!res?.success) throw new Error(res?.error?.message || '注册失败');
      const userData = res.data;
      if (userData?.token) {
        localStorage.setItem('bf_auth_token', userData.token);
        localStorage.setItem('bf_user_profile', JSON.stringify({
          userId: userData.userId,
          phone: userData.phone,
          name: userData.name,
          role: userData.role,
          permissions: userData.permissions
        }));
      }
      await loginUser(userData);
      toast({ title: '注册成功', description: `欢迎，${userData.name}！`, variant: 'default' });
      const p = userData.permissions;
      if (userData.role === 'admin' && p?.can_access_admin) navigate('/admin');
      else if (userData.role === 'driver' && p?.can_access_driver) navigate('/driver');
      else navigate('/passenger');
    } catch (error) {
      toast({ title: '注册失败', description: error.message || '请稍后再试', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  // LINE 快速注册已移除

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // 移除 OTP 流程：改用短信验证码

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* 主�"�R */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">
            註冊 Black Feather 帳號
          </h1>
          <p className="text-gray-300">建立您的帳號以使用車隊管理系統</p>
        </div>

        <Card className="glass">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5" />
              快速註冊
            </CardTitle>
            <CardDescription>請選擇角色並填寫必要資料</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleRegister} className="space-y-6">
              {/* ��0�選�! */}
              <Tabs value={formData.role} onValueChange={(value) => handleInputChange('role', value)}>
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="passenger">
                    <User className="w-4 h-4 mr-2" />
                    乘客
                  </TabsTrigger>
                  <TabsTrigger value="driver">
                    <Car className="w-4 h-4 mr-2" />
                    司機
                  </TabsTrigger>
                  <TabsTrigger value="super_admin">
                    <MessageSquare className="w-4 h-4 mr-2" />
                    管理員</TabsTrigger>
                </TabsList>

                    <div>
                      <label className="text-sm font-medium">邀请码 *</label>
                      <Input type="text" placeholder="请输入邀请码（推荐人手机号）" value={formData.inviteCode} onChange={(e) => handleInputChange('inviteCode', e.target.value)} className="bg-background/50" disabled={loading} />
                    </div>

                <TabsContent value="passenger" className="mt-6">
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium">備註</label>
                      <Input
                        type="tel"
                        placeholder="请输入手机号"
                        value={formData.phone}
                        onChange={(e) => handleInputChange('phone', e.target.value)}
                        className="bg-background/50"
                        disabled={loading}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">�名 *</label>
                      <Input
                        type="text"
                        placeholder="请输入姓名"
                        value={formData.name}
                        onChange={(e) => handleInputChange('name', e.target.value)}
                        className="bg-background/50"
                        disabled={loading}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">設定密碼 **</label>
                      <Input
                        type="password"
                        placeholder="请输入密码"
                        value={formData.password}
                        onChange={(e) => handleInputChange('password', e.target.value)}
                        className="bg-background/50"
                        disabled={loading}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">確認� 碼 *</label>
                      <Input
                        type="password"
                        placeholder="请再次输入密码"
                        value={formData.confirmPassword}
                        onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                        className="bg-background/50"
                        disabled={loading}
                      />
                    </div>
                    <div className="flex items-center">
                      <input id="remember-passenger" type="checkbox" className="mr-2" checked={formData.remember} onChange={(e) => handleInputChange('remember', e.target.checked)} disabled={loading} />
                      <label htmlFor="remember-passenger" className="text-sm">��住����此裝置�0</label>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="driver" className="mt-6">
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium">�09�x�"x碼 *</label>
                      <Input
                        type="tel"
                        placeholder="请输入手机号"
                        value={formData.phone}
                        onChange={(e) => handleInputChange('phone', e.target.value)}
                        className="bg-background/50"
                        disabled={loading}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">�名 *</label>
                      <Input
                        type="text"
                        placeholder="请输入姓名"
                        value={formData.name}
                        onChange={(e) => handleInputChange('name', e.target.value)}
                        className="bg-background/50"
                        disabled={loading}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">�a�稱 *</label>
                      <Input
                        type="text"
                        placeholder="请输入昵称"
                        value={formData.nickname}
                        onChange={(e) => handleInputChange('nickname', e.target.value)}
                        className="bg-background/50"
                        disabled={loading}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">車牌號碼 **</label>
                      <Input
                        type="text"
                        placeholder="请输入车牌号"
                        value={formData.carPlate}
                        onChange={(e) => handleInputChange('carPlate', e.target.value)}
                        className="bg-background/50"
                        disabled={loading}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">�"註</label>
                      <Input
                        type="text"
                        placeholder="请输入备注"
                        value={formData.remarks}
                        onChange={(e) => handleInputChange('remarks', e.target.value)}
                        className="bg-background/50"
                        disabled={loading}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium">設定密碼 **</label>
                        <Input
                          type="password"
                          placeholder="请输入密码"
                          value={formData.password}
                          onChange={(e) => handleInputChange('password', e.target.value)}
                          className="bg-background/50"
                          disabled={loading}
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium">確認� 碼 *</label>
                        <Input
                          type="password"
                          placeholder="请再次输入密码"
                          value={formData.confirmPassword}
                          onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                          className="bg-background/50"
                          disabled={loading}
                        />
                      </div>
                    </div>
                    <div className="flex items-center">
                      <input id="remember-driver" type="checkbox" className="mr-2" checked={formData.remember} onChange={(e) => handleInputChange('remember', e.target.checked)} disabled={loading} />
                      <label htmlFor="remember-driver" className="text-sm">��住����此裝置�0</label>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="super_admin" className="mt-6">
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium">�09�x�"x碼 *</label>
                      <Input
                        type="tel"
                        placeholder="请输入手机号"
                        value={formData.phone}
                        onChange={(e) => handleInputChange('phone', e.target.value)}
                        className="bg-background/50"
                        disabled={loading}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">�名 *</label>
                      <Input
                        type="text"
                        placeholder="请输入姓名"
                        value={formData.name}
                        onChange={(e) => handleInputChange('name', e.target.value)}
                        className="bg-background/50"
                        disabled={loading}
                      />
                    </div>
                    <div className="p-4 bg-warning/10 border border-warning/20 rounded-lg">
                      <p className="text-sm text-warning-foreground">
                        �a�️ 管� ��帳�"x�S�要系統審核�R註� `�R�9聯繫�`����援�9�a�`�"��
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium">設定密碼 **</label>
                      <Input
                        type="password"
                        placeholder="请输入密码"
                        value={formData.password}
                        onChange={(e) => handleInputChange('password', e.target.value)}
                        className="bg-background/50"
                        disabled={loading}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">確認� 碼 *</label>
                      <Input
                        type="password"
                        placeholder="请再次输入密码"
                        value={formData.confirmPassword}
                        onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                        className="bg-background/50"
                        disabled={loading}
                      />
                    </div>
                    <div className="flex items-center">
                      <input id="remember-admin" type="checkbox" className="mr-2" checked={formData.remember} onChange={(e) => handleInputChange('remember', e.target.checked)} disabled={loading} />
                      <label htmlFor="remember-admin" className="text-sm">��住����此裝置�0</label>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>

              {/* 移�"� OTP 註� `流�9�:�9��S�� �S�要可��此�`��&� reCAPTCHA 容�"� */}
              <div id="firebase-reCAPTCHA" className="mt-2" style={{ display: 'none' }} />

              <Button 
                type="submit" 
                className="w-full btn-primary"
                disabled={loading}
              >
                {loading ? '註冊中...' : '註冊帳號'}
              </Button>
              {/* LINE 快�x註� `已移�"� */}
            </form>

            <div className="mt-6 text-center">
              <p className="text-sm text-muted-foreground">
                已有帳號？ 
                <button 
                  onClick={() => navigate('/login')}
                  className="text-primary hover:underline font-medium"
                >
                  立即登入
                </button>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default RegisterPage;










