import React from "react";

export default function PassengerRidePage() {
  return (
    <div className="p-6 space-y-3">
      <h1 className="text-xl font-bold">乘客行程</h1>
      <p className="text-sm text-muted-foreground">此頁面目前為繁體中文的占位介面，待功能修復後將顯示完整行程資訊。</p>
      <div className="rounded border p-3">
        <p className="text-sm">暫無可顯示的行程內容。</p>
      </div>
    </div>
  );
}
