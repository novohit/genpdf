#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
读取Excel文件中的英文名列表
"""

import pandas as pd
import re
import os
import json

def is_english_name(name):
    """
    判断是否为英文名（包含英文字母）
    
    Args:
        name (str): 姓名
        
    Returns:
        bool: 是否为英文名
    """
    return bool(re.search(r'[a-zA-Z]', name))

def extract_english_name_from_text(text):
    """
    从文本中提取英文名，如果找不到英文名则保留原文本
    
    Args:
        text (str): 包含姓名信息的文本
        
    Returns:
        str: 英文名或原文本
    """
    # 移除性别标识
    text_clean = re.sub(r'（女）|（男）', '', text)
    
    # 分割文本，查找括号
    parts = re.split(r'[（）()]', text_clean)
    
    if len(parts) >= 2:
        # 检查每个部分，找到包含英文字母的部分
        for part in parts:
            part = part.strip()
            if part and is_english_name(part):
                return part
    
    # 如果没有括号，检查整个文本是否包含英文
    if is_english_name(text_clean):
        # 提取英文字符部分
        english_match = re.search(r'[a-zA-Z\s\.\-]+', text_clean)
        if english_match:
            return english_match.group().strip()
    
    # 如果找不到英文名，返回原文本
    return text.strip()

def read_english_names_from_excel(file_path):
    """
    从Excel文件中读取英文名列表
    
    Args:
        file_path (str): Excel文件路径
        
    Returns:
        list: 英文名列表
    """
    try:
        # 读取Excel文件
        df = pd.read_excel(file_path)
        
        # 获取第一列数据（包含姓名信息）
        first_column = df.iloc[:, 0]
        
        names = []
        
        for value in first_column:
            if pd.isna(value):
                continue
                
            # 将值转换为字符串
            value_str = str(value)
            
            # 跳过标题行
            if value_str == "学术-姓名":
                continue
            
            # 提取英文名或保留原文本
            name = extract_english_name_from_text(value_str)
            
            if name:
                names.append(name)
        
        return names
        
    except Exception as e:
        print(f"读取Excel文件时出错: {e}")
        return []

def save_array_to_file(array, filename):
    """
    将数组保存到文件，支持多种格式
    
    Args:
        array (list): 要保存的数组
        filename (str): 文件名
    """
    # 保存为JSON格式
    json_filename = filename.replace('.txt', '.json')
    with open(json_filename, 'w', encoding='utf-8') as f:
        json.dump(array, f, ensure_ascii=False, indent=2)
    print(f"JSON格式已保存到: {json_filename}")
    
    # 保存为Python数组格式（带引号）
    py_filename = filename.replace('.txt', '.py')
    with open(py_filename, 'w', encoding='utf-8') as f:
        f.write("# 英文名数组列表\n")
        f.write("english_names = [\n")
        for i, name in enumerate(array):
            if i == len(array) - 1:
                f.write(f'    "{name}"\n')
            else:
                f.write(f'    "{name}",\n')
        f.write("]\n")
    print(f"Python数组格式已保存到: {py_filename}")
    
    # 保存为纯文本格式（每行一个，带引号）
    with open(filename, 'w', encoding='utf-8') as f:
        for name in array:
            f.write(f'"{name}"\n')
    print(f"文本格式已保存到: {filename}")

def main():
    """主函数"""
    # Excel文件路径
    excel_file = "产业.xlsx"
    
    # 检查文件是否存在
    if not os.path.exists(excel_file):
        print(f"错误: 文件 '{excel_file}' 不存在")
        return
    
    print(f"正在读取文件: {excel_file}")
    
    # 读取英文名列表
    names = read_english_names_from_excel(excel_file)
    
    if names:
        print(f"\n找到 {len(names)} 个姓名:")
        print("-" * 50)
        
        for i, name in enumerate(names, 1):
            print(f"{i:2d}. {name}")
        
        print("-" * 50)
        print(f"总计: {len(names)} 个姓名")
        
        # 直接输出数组列表（带引号）
        print("\n姓名数组列表:")
        print("[")
        for i, name in enumerate(names):
            if i == len(names) - 1:
                print(f'    "{name}"')
            else:
                print(f'    "{name}",')
        print("]")
        
        # 保存到文件
        output_file = "english_names.txt"
        save_array_to_file(names, output_file)
        
    else:
        print("未找到任何姓名")

if __name__ == "__main__":
    main() 