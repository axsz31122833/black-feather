import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Textarea } from './ui/textarea';
import { useToast } from '../hooks/use-toast';
import { MessageSquare, Send } from 'lucide-react';
import invokeWithAuth from '../lib/functions';
import { useApp } from '../contexts/AppContext';

function IssueReportModal({ trigger, rideId = null }) {
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    issueType: '',
    title: '',
    description: ''
  });
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useApp();

  const issueTypes = [
    { value: 'driver_issue', label: '司機問題' },
    { value: 'passenger_issue', label: '乘客問題' },
    { value: 'payment_issue', label: '費用問題' },
    { value: 'service_issue', label: '服務品質' },
    { value: 'system_issue', label: '系統問題' },
    { value: 'safety_issue', label: '安全問題' },
    { value: 'other', label: '其他問題' }
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.issueType || !formData.title.trim() || !formData.description.trim()) {
      toast({
        title: '輸入錯誤',
        description: '請填寫所有必要欄位',
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);
    
    try {
      const data = await invokeWithAuth('submit-issue', {
        reporterPhone: user.phone,
        reporterRole: user.role,
        rideId: rideId,
        issueType: formData.issueType,
        title: formData.title,
        description: formData.description
      });

      if (data?.success) {
        toast({
          title: '提交成功',
          description: data.message || '您的問題已提交，我們會盡快處理',
          variant: 'default'
        });
        
        // 重置表單並關閉對話框
        setFormData({ issueType: '', title: '', description: '' });
        setOpen(false);
      } else {
        throw new Error(data?.error?.message || '提交失敗');
      }
    } catch (error) {
      toast({
        title: '提交失敗',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4" />
            問題回報
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-primary" />
            問題回報
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">問題類型 *</label>
            <Select 
              value={formData.issueType} 
              onValueChange={(value) => handleInputChange('issueType', value)}
              disabled={loading}
            >
              <SelectTrigger className="bg-background/50">
                <SelectValue placeholder="請選擇問題類型" />
              </SelectTrigger>
              <SelectContent>
                {issueTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <label className="text-sm font-medium mb-2 block">問題標題 *</label>
            <Input
              type="text"
              placeholder="簡要描述您遇到的問題"
              value={formData.title}
              onChange={(e) => handleInputChange('title', e.target.value)}
              className="bg-background/50"
              disabled={loading}
            />
          </div>
          
          <div>
            <label className="text-sm font-medium mb-2 block">詳細描述 *</label>
            <Textarea
              placeholder="請詳細描述您遇到的問題，包括發生時間、具體情況等..."
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              className="bg-background/50 min-h-[100px]"
              disabled={loading}
            />
          </div>
          
          {rideId && (
            <div className="p-3 bg-info/10 border border-info/20 rounded">
              <p className="text-xs text-info-foreground">
                📝 此問題將與訂單 ID: {rideId} 關聯
              </p>
            </div>
          )}
          
          <div className="flex gap-2 pt-2">
            <Button 
              type="button" 
              variant="outline" 
              className="flex-1"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              取消
            </Button>
            <Button 
              type="submit" 
              className="flex-1 btn-primary"
              disabled={loading}
            >
              {loading ? (
                '提交中...'
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  提交
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default IssueReportModal;