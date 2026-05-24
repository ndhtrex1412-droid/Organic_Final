import requests
import sys
import json
from datetime import datetime

class OrganicFoodStoreAPITester:
    def __init__(self, base_url="https://farm-to-table-app-10.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

    def log_test(self, name, success, details=""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
        
        result = {
            "test": name,
            "success": success,
            "details": details,
            "timestamp": datetime.now().isoformat()
        }
        self.test_results.append(result)
        
        status = "✅ PASSED" if success else "❌ FAILED"
        print(f"{status} - {name}")
        if details:
            print(f"   Details: {details}")

    def run_test(self, name, method, endpoint, expected_status, data=None, auth_required=True):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        if auth_required and self.token:
            headers['Authorization'] = f'Bearer {self.token}'

        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=10)

            success = response.status_code == expected_status
            details = f"Status: {response.status_code}, Expected: {expected_status}"
            
            if not success:
                try:
                    error_detail = response.json()
                    details += f", Response: {error_detail}"
                except:
                    details += f", Response: {response.text[:200]}"
            
            self.log_test(name, success, details)
            
            if success:
                try:
                    return True, response.json()
                except:
                    return True, {}
            else:
                return False, {}

        except Exception as e:
            self.log_test(name, False, f"Error: {str(e)}")
            return False, {}

    def test_admin_login(self):
        """Test admin login with correct credentials"""
        print("\n🔐 Testing Authentication...")
        
        success, response = self.run_test(
            "Admin Login",
            "POST",
            "auth/login",
            200,
            data={"username": "admin68", "password": "password123"},
            auth_required=False
        )
        
        if success and 'token' in response:
            self.token = response['token']
            print(f"   Token received: {self.token[:20]}...")
            return True
        return False

    def test_invalid_login(self):
        """Test login with invalid credentials"""
        success, _ = self.run_test(
            "Invalid Login",
            "POST",
            "auth/login",
            401,
            data={"username": "wrong", "password": "wrong"},
            auth_required=False
        )
        return success

    def test_auth_verify(self):
        """Test token verification"""
        success, response = self.run_test(
            "Auth Verify",
            "GET",
            "auth/verify",
            200
        )
        
        if success and response.get('authenticated'):
            print(f"   Authenticated user: {response.get('username')}")
        return success

    def test_products_crud(self):
        """Test complete product CRUD operations"""
        print("\n📦 Testing Product CRUD...")
        
        # Test GET products
        success, products = self.run_test(
            "Get Products",
            "GET",
            "products",
            200
        )
        
        if not success:
            return False
            
        print(f"   Found {len(products)} existing products")
        
        # Test CREATE product
        test_product = {
            "ProductName": "Test Organic Apples",
            "PathImage": "https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6",
            "ProductType": "Fruits",
            "Quantity": 25.5,
            "Unit": "kg",
            "Price": 5.99,
            "Description": "Fresh organic apples for testing"
        }
        
        success, created_product = self.run_test(
            "Create Product",
            "POST",
            "products",
            201,
            data=test_product
        )
        
        if not success:
            return False
            
        product_id = created_product.get('ProductID')
        print(f"   Created product ID: {product_id}")
        
        # Test UPDATE product
        update_data = {
            "ProductName": "Updated Test Organic Apples",
            "Price": 6.99
        }
        
        success, updated_product = self.run_test(
            "Update Product",
            "PUT",
            f"products/{product_id}",
            200,
            data=update_data
        )
        
        if success:
            print(f"   Updated product name: {updated_product.get('ProductName')}")
            print(f"   Updated price: ${updated_product.get('Price')}")
        
        # Test DELETE product
        success, _ = self.run_test(
            "Delete Product",
            "DELETE",
            f"products/{product_id}",
            200
        )
        
        return success

    def test_product_not_found(self):
        """Test product operations with non-existent ID"""
        fake_id = "non-existent-id"
        
        # Test GET non-existent product
        success = self.run_test(
            "Get Non-existent Product",
            "PUT",
            f"products/{fake_id}",
            404,
            data={"ProductName": "Test"}
        )[0]
        
        return success

    def test_ai_chat(self):
        """Test AI nutrition chatbot"""
        print("\n🤖 Testing AI Nutrition Chat...")
        
        test_message = "What are the health benefits of organic tomatoes?"
        
        success, response = self.run_test(
            "AI Chat",
            "POST",
            "chat",
            200,
            data={"message": test_message}
        )
        
        if success and 'response' in response:
            ai_response = response['response']
            print(f"   AI Response length: {len(ai_response)} characters")
            print(f"   AI Response preview: {ai_response[:100]}...")
            
            # Check if response contains relevant nutrition info
            nutrition_keywords = ['vitamin', 'nutrient', 'health', 'benefit', 'organic', 'tomato']
            found_keywords = [word for word in nutrition_keywords if word.lower() in ai_response.lower()]
            print(f"   Found nutrition keywords: {found_keywords}")
            
            return len(found_keywords) > 0
        
        return success

    def test_unauthorized_access(self):
        """Test accessing protected endpoints without token"""
        print("\n🚫 Testing Unauthorized Access...")
        
        # Temporarily remove token
        original_token = self.token
        self.token = None
        
        success = self.run_test(
            "Unauthorized Products Access",
            "GET",
            "products",
            401
        )[0]
        
        # Restore token
        self.token = original_token
        return success

    def run_all_tests(self):
        """Run all API tests"""
        print("🧪 Starting Organic Food Store API Tests")
        print(f"🌐 Testing against: {self.base_url}")
        print("=" * 60)
        
        # Authentication tests
        if not self.test_admin_login():
            print("❌ Login failed - stopping tests")
            return False
            
        self.test_invalid_login()
        self.test_auth_verify()
        
        # Product CRUD tests
        self.test_products_crud()
        self.test_product_not_found()
        
        # AI Chat test
        self.test_ai_chat()
        
        # Security tests
        self.test_unauthorized_access()
        
        # Print summary
        print("\n" + "=" * 60)
        print(f"📊 Test Summary: {self.tests_passed}/{self.tests_run} tests passed")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All tests passed!")
            return True
        else:
            print("⚠️  Some tests failed")
            failed_tests = [r for r in self.test_results if not r['success']]
            print("\nFailed tests:")
            for test in failed_tests:
                print(f"  - {test['test']}: {test['details']}")
            return False

def main():
    tester = OrganicFoodStoreAPITester()
    success = tester.run_all_tests()
    
    # Save detailed results
    with open('/app/test_reports/backend_api_results.json', 'w') as f:
        json.dump({
            'summary': {
                'total_tests': tester.tests_run,
                'passed_tests': tester.tests_passed,
                'success_rate': f"{(tester.tests_passed/tester.tests_run)*100:.1f}%",
                'timestamp': datetime.now().isoformat()
            },
            'detailed_results': tester.test_results
        }, f, indent=2)
    
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())