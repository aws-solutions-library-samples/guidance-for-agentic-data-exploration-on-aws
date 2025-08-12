#!/usr/bin/env python3
"""
Simple test script to verify the bulk loader error truncation logic
"""

import json

def calculate_payload_size_kb(payload):
    """
    Calculate the approximate size of a payload in KB
    """
    if not payload:
        return 0
    try:
        payload_json = json.dumps(payload, indent=2)
        return len(payload_json.encode('utf-8')) / 1024
    except Exception as e:
        print(f"Error calculating payload size: {str(e)}")
        return 0

def truncate_errors_in_payload(payload, max_errors=10):
    """
    Truncate errors in the payload to reduce size
    """
    if not payload or 'loadDetails' not in payload:
        return payload
    
    payload_copy = payload.copy()
    total_truncated = 0
    
    for detail in payload_copy.get('loadDetails', []):
        if 'errors' in detail and isinstance(detail['errors'], list):
            original_count = len(detail['errors'])
            if original_count > max_errors:
                detail['errors'] = detail['errors'][:max_errors]
                detail['errors'].append({
                    'errorMessage': f'... and {original_count - max_errors} more errors (truncated for storage)',
                    'errorCode': 'TRUNCATED',
                    'fileName': 'SYSTEM_MESSAGE'
                })
                detail['originalErrorCount'] = original_count
                total_truncated += (original_count - max_errors)
    
    if total_truncated > 0:
        print(f"Truncated {total_truncated} errors from payload")
    
    return payload_copy

def create_large_payload_with_errors(num_errors=1000):
    """Create a test payload with many errors"""
    errors = []
    for i in range(num_errors):
        errors.append({
            'errorMessage': f'Error message {i}: This is a sample error message that contains some details about what went wrong during the bulk load process. The error occurred while processing record {i}.',
            'errorCode': f'ERROR_CODE_{i}',
            'fileName': f'test_file_{i}.csv',
            'lineNumber': i + 1,
            'columnName': 'test_column',
            'details': f'Additional error details for error {i} with more context and information'
        })
    
    payload = {
        'overallStatus': {
            'status': 'LOAD_COMPLETED_WITH_ERRORS',
            'totalRecords': 10000,
            'totalTimeSpent': 300
        },
        'loadDetails': [
            {
                'source': 's3://test-bucket/test-data.csv',
                'status': 'LOAD_COMPLETED_WITH_ERRORS',
                'totalRecords': 10000,
                'errors': errors
            }
        ]
    }
    
    return payload

def test_payload_size_calculation():
    """Test the payload size calculation function"""
    print("Testing payload size calculation...")
    
    # Test with empty payload
    assert calculate_payload_size_kb(None) == 0
    assert calculate_payload_size_kb({}) == 0
    
    # Test with small payload
    small_payload = {'test': 'data'}
    size = calculate_payload_size_kb(small_payload)
    assert size > 0
    print(f"Small payload size: {size:.2f} KB")
    
    # Test with large payload
    large_payload = create_large_payload_with_errors(100)
    large_size = calculate_payload_size_kb(large_payload)
    print(f"Large payload (100 errors) size: {large_size:.2f} KB")
    
    print("✓ Payload size calculation tests passed")

def test_error_truncation():
    """Test the error truncation functionality"""
    print("\nTesting error truncation...")
    
    # Create payload with many errors
    original_payload = create_large_payload_with_errors(500)
    original_size = calculate_payload_size_kb(original_payload)
    print(f"Original payload size: {original_size:.2f} KB")
    print(f"Original error count: {len(original_payload['loadDetails'][0]['errors'])}")
    
    # Test truncation to 10 errors
    truncated_payload = truncate_errors_in_payload(original_payload, max_errors=10)
    truncated_size = calculate_payload_size_kb(truncated_payload)
    truncated_error_count = len(truncated_payload['loadDetails'][0]['errors'])
    
    print(f"Truncated payload size (10 errors): {truncated_size:.2f} KB")
    print(f"Truncated error count: {truncated_error_count}")
    
    # Verify truncation worked
    assert truncated_size < original_size
    assert truncated_error_count == 11  # 10 original + 1 truncation message
    assert 'originalErrorCount' in truncated_payload['loadDetails'][0]
    assert truncated_payload['loadDetails'][0]['originalErrorCount'] == 500
    
    # Check that the last error is the truncation message
    last_error = truncated_payload['loadDetails'][0]['errors'][-1]
    assert last_error['errorCode'] == 'TRUNCATED'
    assert 'truncated for storage' in last_error['errorMessage']
    
    print("✓ Error truncation tests passed")

def test_aggressive_truncation():
    """Test aggressive truncation for very large payloads"""
    print("\nTesting aggressive truncation...")
    
    # Create a very large payload
    huge_payload = create_large_payload_with_errors(2000)
    original_size = calculate_payload_size_kb(huge_payload)
    print(f"Huge payload size: {original_size:.2f} KB")
    
    # Test aggressive truncation to 3 errors
    aggressively_truncated = truncate_errors_in_payload(huge_payload, max_errors=3)
    final_size = calculate_payload_size_kb(aggressively_truncated)
    final_error_count = len(aggressively_truncated['loadDetails'][0]['errors'])
    
    print(f"Aggressively truncated payload size: {final_size:.2f} KB")
    print(f"Final error count: {final_error_count}")
    
    # Verify aggressive truncation
    assert final_size < original_size
    assert final_error_count == 4  # 3 original + 1 truncation message
    
    print("✓ Aggressive truncation tests passed")

def test_no_truncation_needed():
    """Test that small payloads are not truncated"""
    print("\nTesting no truncation needed...")
    
    small_payload = create_large_payload_with_errors(5)
    original_size = calculate_payload_size_kb(small_payload)
    print(f"Small payload size: {original_size:.2f} KB")
    
    # Should not be truncated
    result_payload = truncate_errors_in_payload(small_payload, max_errors=10)
    result_size = calculate_payload_size_kb(result_payload)
    
    # Should be identical
    assert result_size == original_size
    assert len(result_payload['loadDetails'][0]['errors']) == 5
    assert 'originalErrorCount' not in result_payload['loadDetails'][0]
    
    print("✓ No truncation needed tests passed")

def test_size_limit_scenario():
    """Test a realistic scenario that would exceed DynamoDB limits"""
    print("\nTesting realistic size limit scenario...")
    
    # Create a payload that would exceed 350KB
    large_payload = create_large_payload_with_errors(1500)
    original_size = calculate_payload_size_kb(large_payload)
    print(f"Large payload size: {original_size:.2f} KB")
    
    # This should be larger than our 350KB limit
    assert original_size > 350, f"Test payload should be > 350KB, got {original_size:.2f}KB"
    
    # Apply our truncation logic
    if original_size > 350:
        print("Payload exceeds 350KB limit, truncating...")
        
        # Try truncating with 10 errors first
        payload_to_store = truncate_errors_in_payload(large_payload, max_errors=10)
        new_size = calculate_payload_size_kb(payload_to_store)
        print(f"Size after truncation (10 errors): {new_size:.2f} KB")
        
        # If still too large, truncate more aggressively
        if new_size > 350:
            print("Still too large, truncating to 3 errors per source")
            payload_to_store = truncate_errors_in_payload(large_payload, max_errors=3)
            final_size = calculate_payload_size_kb(payload_to_store)
            print(f"Final size after aggressive truncation: {final_size:.2f} KB")
            
            # Should now be under the limit
            assert final_size < 350, f"Final payload should be < 350KB, got {final_size:.2f}KB"
    
    print("✓ Size limit scenario test passed")

if __name__ == "__main__":
    print("Running bulk loader truncation tests...\n")
    
    try:
        test_payload_size_calculation()
        test_error_truncation()
        test_aggressive_truncation()
        test_no_truncation_needed()
        test_size_limit_scenario()
        
        print("\n🎉 All tests passed! The bulk loader error truncation logic is working correctly.")
        
    except Exception as e:
        print(f"\n❌ Test failed: {str(e)}")
        import traceback
        traceback.print_exc()
        exit(1)
