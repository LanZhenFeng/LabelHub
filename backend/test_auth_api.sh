#!/bin/bash
# M4 后端认证API测试脚本

API="http://localhost:8000/api/v1"

echo "========================================="
echo "M4 后端认证API测试"
echo "========================================="

echo -e "\n1️⃣  健康检查..."
curl -s "$API/healthz" | jq . || echo "❌ 健康检查失败"

echo -e "\n2️⃣  使用默认admin账户登录..."
echo "   用户名: admin"
echo "   密码: admin123"

LOGIN_RESPONSE=$(curl -s -X POST "$API/auth/login" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=admin&password=admin123")

echo "$LOGIN_RESPONSE" | jq .

# 提取access_token
ACCESS_TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.access_token')

if [ "$ACCESS_TOKEN" == "null" ] || [ -z "$ACCESS_TOKEN" ]; then
    echo "❌ 登录失败，无法获取token"
    exit 1
fi

echo -e "\n✅ 登录成功！"
echo "Access Token (前50字符): ${ACCESS_TOKEN:0:50}..."

echo -e "\n3️⃣  使用token获取当前用户信息..."
curl -s "$API/auth/me" \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq .

echo -e "\n4️⃣  测试用户列表（管理员权限）..."
curl -s "$API/users?page=1&limit=10" \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq .

echo -e "\n5️⃣  测试注册新用户（annotator）..."
REGISTER_RESPONSE=$(curl -s -X POST "$API/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "test_annotator",
    "email": "test@example.com",
    "password": "test1234"
  }')

echo "$REGISTER_RESPONSE" | jq .

# 检查是否注册成功
if echo "$REGISTER_RESPONSE" | jq -e '.user.id' > /dev/null 2>&1; then
    echo -e "\n✅ 新用户注册成功"
else
    echo -e "\n⚠️  用户可能已存在或注册失败"
fi

echo -e "\n========================================="
echo "✅ M4后端认证API测试完成！"
echo "========================================="
echo -e "\n💡 下一步："
echo "   1. 访问 http://localhost:8000/docs 查看完整API文档"
echo "   2. 在Swagger UI中点击 'Authorize' 按钮"
echo "   3. 输入: Bearer $ACCESS_TOKEN"
echo "   4. 测试其他受保护的API"

