package com.rajasoftware.leavemanagement.repository;

import com.rajasoftware.leavemanagement.model.LeaveRequest;

import java.util.List;
import java.util.Optional;

public interface LeaveRepository {

    List<LeaveRequest> findAll();

    Optional<LeaveRequest> findById(Long id);

    List<LeaveRequest> findByEmployeeId(String employeeId);

    LeaveRequest save(LeaveRequest leaveRequest);

    boolean deleteById(Long id);
}
