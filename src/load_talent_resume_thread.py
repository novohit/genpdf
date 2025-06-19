import requests
import json
from concurrent.futures import ThreadPoolExecutor, as_completed
import os
from tqdm import tqdm
from datetime import datetime

base_url = "http://172.22.121.63:32738/api"

def fetch_talents(token):
    url = f"{base_url}/talents/filters"
    
    headers = {
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json'
    }
    
    payload = {
        "filters": {
            "isChinese": ["1"],
            "major2Domain": ["人工智能"]
        },
        "keyword": "",
        "page": 0,
        "size": 500,
        "needAggregations": True
    }
    
    try:
        response = requests.post(url, json=payload, headers=headers)
        response.raise_for_status()
        response_data = response.json()

        return response_data.get('data', {}).get('records', [])
    except requests.exceptions.RequestException as e:
        print(f"Error making request: {e}")
        return None

def fetch_teacher_papers(teacher_id, token):
    url = f"{base_url}/papers/{teacher_id}/page"
    
    headers = {
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json'
    }
    
    payload = {
        "page": 1,
        "size": 1000
    }

    try:
        response = requests.post(url, json=payload, headers=headers)
        response.raise_for_status()
        response_data = response.json()
        return response_data.get('data', {}).get('list', [])
    except requests.exceptions.RequestException as e:
        print(f"Error fetching papers for teacher {teacher_id}: {e}")
        return []

def generate_resume(teacher_data, papers, token, index=None):
    url = "http://localhost:3000/generate-pdf"
    
    headers = {
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json'
    }
    
    payload = {
        "teacherData": teacher_data,
        "papers": papers
    }
    
    try:
        response = requests.post(url, json=payload, headers=headers)
        response.raise_for_status()
        
        # 获取教师姓名，用于文件名
        teacher_name = teacher_data.get('derivedTeacherName', 'unknown')
        # 构建PDF文件路径，添加序号
        index_str = f"{index:03d}_" if index is not None else ""  # 格式化为3位数，例如：001_
        pdf_path = f"../output/resumes_order/{index_str}{teacher_name}_resume.pdf"
        
        # 将PDF内容写入文件
        with open(pdf_path, 'wb') as f:
            f.write(response.content)
        
        return {
            "success": True,
            "file_path": pdf_path,
            "message": f"PDF saved successfully at {pdf_path}"
        }
    except requests.exceptions.RequestException as e:
        print(f"Error generating resume: {e}")
        return None
    except IOError as e:
        print(f"Error saving PDF file: {e}")
        return None

def process_single_talent(talent, token, index=None):
    teacher_id = talent.get('teacherId')
    teacher_name = talent.get('derivedTeacherName')
    if not teacher_id:
        return {
            "success": False,
            "teacher_name": teacher_name,
            "message": "No teacher ID found",
            "index": index
        }
    
    print(f"\nProcessing {teacher_name} (ID: {teacher_id})")
    papers = fetch_teacher_papers(teacher_id, token)
    result = generate_resume(talent, papers, token, index)
    
    if result is not None:
        return {
            "success": True,
            "teacher_name": teacher_name,
            "message": result['message'],
            "index": index
        }
    else:
        return {
            "success": False,
            "teacher_name": teacher_name,
            "message": "Failed to generate resume",
            "index": index
        }

if __name__ == "__main__":
    os.makedirs("../output/resumes_order", exist_ok=True)
    
    start_time = datetime.now()
    token = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJsb2dpblR5cGUiOiJsb2dpbiIsImxvZ2luSWQiOjc2LCJkZXZpY2UiOiJkZWZhdWx0LWRldmljZSIsImVmZiI6MTc1MjY1MjU1MjAzOCwicm5TdHIiOiJXT2syeWgzRlFkaGJ1eVd3NkgxamRPbm9DUVFVNUJMMyJ9.OvZKcdEZQk-Eg1rtN35ZYoTxqFh-RMtT9nK-iaq6i4Q"
    
    print("🔍 Fetching talents list...")
    talents = fetch_talents(token)
    
    if talents is not None:
        total_talents = len(talents)
        print(f"📋 Found {total_talents} talents to process")
        
        success_count = 0
        failed_count = 0
        
        # 使用线程池处理简历生成
        max_workers = min(10, total_talents)
        print(f"⚙️ Using {max_workers} threads for processing")
        
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            # 提交所有任务，并传入索引
            future_to_talent = {
                executor.submit(process_single_talent, talent, token, idx + 1): talent
                for idx, talent in enumerate(talents)
            }
            
            # 使用tqdm创建进度条
            with tqdm(total=total_talents, desc="Processing resumes", unit="resume") as pbar:
                # 处理完成的任务
                for future in as_completed(future_to_talent):
                    result = future.result()
                    if result["success"]:
                        success_count += 1
                        status = "✅"
                    else:
                        failed_count += 1
                        status = "❌"
                    
                    # 更新进度条，显示序号
                    pbar.update(1)
                    # 显示当前处理的简历状态（包含序号）
                    pbar.set_postfix_str(f"{status} [{result['index']:03d}] {result['teacher_name']}")
        
        # 显示最终统计信息
        end_time = datetime.now()
        duration = end_time - start_time
        print("\n📊 Processing Summary:")
        print(f"✅ Successful: {success_count}")
        print(f"❌ Failed: {failed_count}")
        print(f"⏱️ Total time: {duration.total_seconds():.2f} seconds")
        print(f"⚡ Average time per resume: {(duration.total_seconds() / total_talents):.2f} seconds")
                
