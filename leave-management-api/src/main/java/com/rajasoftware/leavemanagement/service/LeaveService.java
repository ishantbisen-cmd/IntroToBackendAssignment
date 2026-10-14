package com.rajasoftware.leavemanagement.service;

import com.rajasoftware.leavemanagement.dto.LeaveRequestDto;
import com.rajasoftware.leavemanagement.dto.LeaveResponseDto;

import java.util.List;

public interface LeaveService {

    List<LeaveResponseDto> getAll();

    LeaveResponseDto getById(Long id);

    LeaveResponseDto create(LeaveRequestDto request);

    LeaveResponseDto update(Long id, LeaveRequestDto request);

    void delete(Long id);
}
