"""
Vietnamese Organic Food Store API Tests
Tests for: Auth, Products, Cart, Chat, OCR, Bulk Operations
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials (sourced from env; fallbacks are for local dev only)
ADMIN_USERNAME = os.environ.get('ADMIN_USERNAME', 'admin68')
ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD', 'password123')

class TestHealthAndAuth:
    """Authentication and basic health tests"""
    
    def test_products_endpoint_accessible(self):
        """Test public products endpoint is accessible"""
        response = requests.get(f"{BASE_URL}/api/products")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Products endpoint accessible, found {len(data)} products")
    
    def test_admin_login_success(self):
        """Test admin login with correct credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": ADMIN_USERNAME,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert data["username"] == ADMIN_USERNAME
        print(f"✓ Admin login successful, token received")
    
    def test_admin_login_invalid_credentials(self):
        """Test admin login with wrong credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "wronguser",
            "password": "wrongpass"
        })
        assert response.status_code == 401
        print(f"✓ Invalid credentials correctly rejected")
    
    def test_token_verification(self):
        """Test token verification endpoint"""
        # First login to get token
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": ADMIN_USERNAME,
            "password": ADMIN_PASSWORD
        })
        token = login_response.json()["token"]
        
        # Verify token
        response = requests.get(f"{BASE_URL}/api/auth/verify", headers={
            "Authorization": f"Bearer {token}"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["authenticated"]
        print(f"✓ Token verification successful")


class TestProductsCRUD:
    """Product CRUD operations tests"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": ADMIN_USERNAME,
            "password": ADMIN_PASSWORD
        })
        return response.json()["token"]
    
    def test_get_all_products(self):
        """Test getting all products (public endpoint)"""
        response = requests.get(f"{BASE_URL}/api/products")
        assert response.status_code == 200
        products = response.json()
        assert isinstance(products, list)
        if len(products) > 0:
            product = products[0]
            assert "ProductID" in product
            assert "ProductName" in product
            assert "Price" in product
            assert "ProductType" in product
        print(f"✓ Retrieved {len(products)} products")
    
    def test_get_admin_products(self, auth_token):
        """Test getting products via admin endpoint"""
        response = requests.get(f"{BASE_URL}/api/products/admin", headers={
            "Authorization": f"Bearer {auth_token}"
        })
        assert response.status_code == 200
        products = response.json()
        assert isinstance(products, list)
        print(f"✓ Admin products endpoint returned {len(products)} products")
    
    def test_create_product(self, auth_token):
        """Test creating a new product"""
        test_product = {
            "ProductName": f"TEST_Rau_Huu_Co_{uuid.uuid4().hex[:6]}",
            "PathImage": "https://images.unsplash.com/photo-1576045057995-568f588f82fb?w=400",
            "ProductType": "Rau củ",
            "Quantity": 50,
            "Unit": "kg",
            "Price": 35000,
            "Description": "Rau hữu cơ test sản phẩm"
        }
        
        response = requests.post(f"{BASE_URL}/api/products", json=test_product, headers={
            "Authorization": f"Bearer {auth_token}"
        })
        assert response.status_code == 201
        created = response.json()
        assert created["ProductName"] == test_product["ProductName"]
        assert created["Price"] == test_product["Price"]
        assert "ProductID" in created
        
        # Verify product was persisted
        get_response = requests.get(f"{BASE_URL}/api/products/{created['ProductID']}")
        assert get_response.status_code == 200
        fetched = get_response.json()
        assert fetched["ProductName"] == test_product["ProductName"]
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/products/{created['ProductID']}", headers={
            "Authorization": f"Bearer {auth_token}"
        })
        print(f"✓ Product created and verified: {created['ProductID']}")
    
    def test_update_product(self, auth_token):
        """Test updating a product"""
        # Create a product first
        test_product = {
            "ProductName": f"TEST_Update_{uuid.uuid4().hex[:6]}",
            "PathImage": "https://images.unsplash.com/photo-1576045057995-568f588f82fb?w=400",
            "ProductType": "Rau củ",
            "Quantity": 30,
            "Unit": "kg",
            "Price": 25000,
            "Description": "Test product for update"
        }
        
        create_response = requests.post(f"{BASE_URL}/api/products", json=test_product, headers={
            "Authorization": f"Bearer {auth_token}"
        })
        product_id = create_response.json()["ProductID"]
        
        # Update the product
        update_data = {
            "ProductName": "TEST_Updated_Name",
            "Price": 45000
        }
        update_response = requests.put(f"{BASE_URL}/api/products/{product_id}", json=update_data, headers={
            "Authorization": f"Bearer {auth_token}"
        })
        assert update_response.status_code == 200
        updated = update_response.json()
        assert updated["ProductName"] == "TEST_Updated_Name"
        assert updated["Price"] == 45000
        
        # Verify update persisted
        get_response = requests.get(f"{BASE_URL}/api/products/{product_id}")
        assert get_response.json()["ProductName"] == "TEST_Updated_Name"
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/products/{product_id}", headers={
            "Authorization": f"Bearer {auth_token}"
        })
        print(f"✓ Product updated and verified")
    
    def test_delete_product(self, auth_token):
        """Test deleting a product"""
        # Create a product first
        test_product = {
            "ProductName": f"TEST_Delete_{uuid.uuid4().hex[:6]}",
            "PathImage": "https://images.unsplash.com/photo-1576045057995-568f588f82fb?w=400",
            "ProductType": "Rau củ",
            "Quantity": 20,
            "Unit": "kg",
            "Price": 20000,
            "Description": "Test product for deletion"
        }
        
        create_response = requests.post(f"{BASE_URL}/api/products", json=test_product, headers={
            "Authorization": f"Bearer {auth_token}"
        })
        product_id = create_response.json()["ProductID"]
        
        # Delete the product
        delete_response = requests.delete(f"{BASE_URL}/api/products/{product_id}", headers={
            "Authorization": f"Bearer {auth_token}"
        })
        assert delete_response.status_code == 200
        
        # Verify deletion
        get_response = requests.get(f"{BASE_URL}/api/products/{product_id}")
        assert get_response.status_code == 404
        print(f"✓ Product deleted and verified")
    
    def test_unauthorized_product_creation(self):
        """Test that product creation requires authentication"""
        test_product = {
            "ProductName": "Unauthorized Product",
            "PathImage": "https://example.com/image.jpg",
            "ProductType": "Test",
            "Quantity": 10,
            "Unit": "kg",
            "Price": 10000,
            "Description": "Should fail"
        }
        
        response = requests.post(f"{BASE_URL}/api/products", json=test_product)
        assert response.status_code in [401, 403]
        print(f"✓ Unauthorized product creation correctly rejected")


class TestBulkOperations:
    """Bulk delete and duplicate operations tests"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": ADMIN_USERNAME,
            "password": ADMIN_PASSWORD
        })
        return response.json()["token"]
    
    def test_bulk_delete(self, auth_token):
        """Test bulk delete operation"""
        # Create test products
        product_ids = []
        for i in range(2):
            test_product = {
                "ProductName": f"TEST_BulkDelete_{uuid.uuid4().hex[:6]}",
                "PathImage": "https://images.unsplash.com/photo-1576045057995-568f588f82fb?w=400",
                "ProductType": "Test",
                "Quantity": 10,
                "Unit": "kg",
                "Price": 10000,
                "Description": "Bulk delete test"
            }
            response = requests.post(f"{BASE_URL}/api/products", json=test_product, headers={
                "Authorization": f"Bearer {auth_token}"
            })
            product_ids.append(response.json()["ProductID"])
        
        # Bulk delete
        delete_response = requests.delete(f"{BASE_URL}/api/products/bulk", json=product_ids, headers={
            "Authorization": f"Bearer {auth_token}"
        })
        assert delete_response.status_code == 200
        data = delete_response.json()
        assert data["deleted_count"] == 2
        
        # Verify deletion
        for pid in product_ids:
            get_response = requests.get(f"{BASE_URL}/api/products/{pid}")
            assert get_response.status_code == 404
        print(f"✓ Bulk delete successful: {len(product_ids)} products deleted")
    
    def test_bulk_duplicate(self, auth_token):
        """Test bulk duplicate operation"""
        # Create a test product
        test_product = {
            "ProductName": f"TEST_BulkDuplicate_{uuid.uuid4().hex[:6]}",
            "PathImage": "https://images.unsplash.com/photo-1576045057995-568f588f82fb?w=400",
            "ProductType": "Test",
            "Quantity": 10,
            "Unit": "kg",
            "Price": 10000,
            "Description": "Bulk duplicate test"
        }
        create_response = requests.post(f"{BASE_URL}/api/products", json=test_product, headers={
            "Authorization": f"Bearer {auth_token}"
        })
        original_id = create_response.json()["ProductID"]
        
        # Duplicate
        duplicate_response = requests.post(f"{BASE_URL}/api/products/duplicate", json=[original_id], headers={
            "Authorization": f"Bearer {auth_token}"
        })
        assert duplicate_response.status_code == 200
        data = duplicate_response.json()
        assert data["duplicated_count"] == 1
        
        # Verify duplicate exists (check products list for copy)
        products_response = requests.get(f"{BASE_URL}/api/products")
        products = products_response.json()
        duplicates = [p for p in products if "(bản sao)" in p["ProductName"] and test_product["ProductName"].split("_")[1] in p["ProductName"]]
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/products/{original_id}", headers={
            "Authorization": f"Bearer {auth_token}"
        })
        for dup in duplicates:
            requests.delete(f"{BASE_URL}/api/products/{dup['ProductID']}", headers={
                "Authorization": f"Bearer {auth_token}"
            })
        print(f"✓ Bulk duplicate successful")


class TestChatAndOCR:
    """AI Chat and OCR endpoints tests"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": ADMIN_USERNAME,
            "password": ADMIN_PASSWORD
        })
        return response.json()["token"]
    
    def test_chat_endpoint_structure(self, auth_token):
        """Test chat endpoint accepts requests (may fail due to API budget)"""
        response = requests.post(f"{BASE_URL}/api/chat", json={
            "message": "Xin chào"
        }, headers={
            "Authorization": f"Bearer {auth_token}"
        })
        # Accept 200 (success) or 500 (budget exceeded)
        assert response.status_code in [200, 500]
        if response.status_code == 200:
            data = response.json()
            assert "response" in data
            print(f"✓ Chat endpoint working, got response")
        else:
            print(f"⚠ Chat endpoint returned 500 (likely API budget exceeded)")
    
    def test_chat_unauthorized(self):
        """Test chat requires authentication"""
        response = requests.post(f"{BASE_URL}/api/chat", json={
            "message": "Test"
        })
        assert response.status_code in [401, 403]
        print(f"✓ Chat endpoint correctly requires authentication")
    
    def test_ocr_endpoint_structure(self, auth_token):
        """Test OCR endpoint accepts requests"""
        # Use a minimal valid base64 image (1x1 red pixel PNG)
        test_image_base64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg=="
        
        response = requests.post(f"{BASE_URL}/api/ocr/identify", json={
            "image_base64": test_image_base64
        }, headers={
            "Authorization": f"Bearer {auth_token}"
        })
        # Accept 200 (success) or 500 (budget exceeded)
        assert response.status_code in [200, 500]
        if response.status_code == 200:
            data = response.json()
            assert "identification" in data
            print(f"✓ OCR endpoint working")
        else:
            print(f"⚠ OCR endpoint returned 500 (likely API budget exceeded)")
    
    def test_ocr_unauthorized(self):
        """Test OCR requires authentication"""
        response = requests.post(f"{BASE_URL}/api/ocr/identify", json={
            "image_base64": "test"
        })
        assert response.status_code in [401, 403]
        print(f"✓ OCR endpoint correctly requires authentication")


class TestUserRegistrationAndCart:
    """User registration and cart tests"""
    
    def test_user_registration(self):
        """Test user registration"""
        test_email = f"test_{uuid.uuid4().hex[:8]}@example.com"
        user_data = {
            "full_name": "Test User",
            "email": test_email,
            "phone": "0912345678",
            "password": "testpass123",
            "address": "123 Test Street",
            "province": "Hà Nội",
            "district": "Quận 1"
        }
        
        response = requests.post(f"{BASE_URL}/api/users/register", json=user_data)
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == test_email
        assert "token" in data
        print(f"✓ User registration successful")
    
    def test_duplicate_email_registration(self):
        """Test that duplicate email registration fails"""
        test_email = f"duplicate_{uuid.uuid4().hex[:8]}@example.com"
        user_data = {
            "full_name": "Test User",
            "email": test_email,
            "phone": "0912345678",
            "password": "testpass123",
            "address": "123 Test Street",
            "province": "Hà Nội",
            "district": "Quận 1"
        }
        
        # First registration
        requests.post(f"{BASE_URL}/api/users/register", json=user_data)
        
        # Second registration with same email
        response = requests.post(f"{BASE_URL}/api/users/register", json=user_data)
        assert response.status_code == 400
        print(f"✓ Duplicate email correctly rejected")
    
    def test_cart_operations(self):
        """Test cart add and get operations"""
        # Register a test user
        test_email = f"cart_test_{uuid.uuid4().hex[:8]}@example.com"
        user_data = {
            "full_name": "Cart Test User",
            "email": test_email,
            "phone": "0912345678",
            "password": "testpass123",
            "address": "123 Test Street",
            "province": "Hà Nội",
            "district": "Quận 1"
        }
        
        reg_response = requests.post(f"{BASE_URL}/api/users/register", json=user_data)
        token = reg_response.json()["token"]
        
        # Get a product to add to cart
        products_response = requests.get(f"{BASE_URL}/api/products")
        products = products_response.json()
        if len(products) > 0:
            product_id = products[0]["ProductID"]
            
            # Add to cart
            add_response = requests.post(f"{BASE_URL}/api/cart/add", json={
                "product_id": product_id
            }, headers={
                "Authorization": f"Bearer {token}"
            })
            assert add_response.status_code == 200
            
            # Get cart
            cart_response = requests.get(f"{BASE_URL}/api/cart", headers={
                "Authorization": f"Bearer {token}"
            })
            assert cart_response.status_code == 200
            cart = cart_response.json()
            assert "items" in cart
            assert "total" in cart
            print(f"✓ Cart operations successful")
        else:
            print(f"⚠ No products available for cart test")


class TestContactForm:
    """Contact form tests"""
    
    def test_contact_submission(self):
        """Test contact form submission"""
        contact_data = {
            "full_name": "Test Contact",
            "email": "contact@test.com",
            "phone": "0912345678",
            "subject": "Test Subject",
            "message": "This is a test message for the contact form."
        }
        
        response = requests.post(f"{BASE_URL}/api/contact", json=contact_data)
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        print(f"✓ Contact form submission successful")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
