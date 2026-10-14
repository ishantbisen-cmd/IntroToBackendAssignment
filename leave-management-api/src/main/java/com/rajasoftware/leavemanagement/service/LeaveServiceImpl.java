package com.rajasoftware.leavemanagement.service;

import com.rajasoftware.leavemanagement.configuration.LeaveProperties;
import com.rajasoftware.leavemanagement.dto.LeaveRequestDto;
import com.rajasoftware.leavemanagement.dto.LeaveResponseDto;
import com.rajasoftware.leavemanagement.exception.InvalidLeaveRequestException;
import com.rajasoftware.leavemanagement.exception.LeaveNotFoundException;
import com.rajasoftware.leavemanagement.model.LeaveRequest;
import com.rajasoftware.leavemanagement.model.LeaveStatus;
import com.rajasoftware.leavemanagement.repository.LeaveRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;

@Service
public class LeaveServiceImpl implements LeaveService {

    private final LeaveRepository leaveRepository;
    private final LeaveProperties leaveProperties;

    public LeaveServiceImpl(LeaveRepository leaveRepository, LeaveProperties leaveProperties) {
        this.leaveRepository = leaveRepository;
        this.leaveProperties = leaveProperties;
    }

    @Override
    public List<LeaveResponseDto> getAll() {
        return leaveRepository.findAll().stream().map(this::toResponse).toList();
    }

    @Override
    public LeaveResponseDto getById(Long id) {
        return toResponse(findExisting(id));
    }

    @Override
    public LeaveResponseDto create(LeaveRequestDto request) {
        checkDuration(request);
        checkOverlap(request.employeeId().trim(), request.startDate(), request.endDate(), null);

        LeaveRequest leave = toEntity(request);
        if (leave.getStatus() == null) {
            leave.setStatus(LeaveStatus.PENDING);
        }
        return toResponse(leaveRepository.save(leave));
    }

    @Override
    public LeaveResponseDto update(Long id, LeaveRequestDto request) {
        LeaveRequest existing = findExisting(id);
        checkDuration(request);
        checkOverlap(request.employeeId().trim(), request.startDate(), request.endDate(), id);

        existing.setEmployeeId(request.employeeId().trim());
        existing.setLeaveType(request.leaveType());
        existing.setStartDate(request.startDate());
        existing.setEndDate(request.endDate());
        existing.setReason(request.reason().trim());
        if (request.status() != null) {
            existing.setStatus(request.status());
        }
        return toResponse(leaveRepository.save(existing));
    }

    @Override
    public void delete(Long id) {
        if (!leaveRepository.deleteById(id)) {
            throw new LeaveNotFoundException(id);
        }
    }

    private LeaveRequest findExisting(Long id) {
        return leaveRepository.findById(id).orElseThrow(() -> new LeaveNotFoundException(id));
    }

    private void checkDuration(LeaveRequestDto request) {
        long days = ChronoUnit.DAYS.between(request.startDate(), request.endDate()) + 1;
        if (days > leaveProperties.getMaxDays()) {
            throw new InvalidLeaveRequestException(
                    HttpStatus.BAD_REQUEST,
                    "A leave request cannot be longer than " + leaveProperties.getMaxDays() + " days."
            );
        }
    }

    private void checkOverlap(String employeeId, LocalDate start, LocalDate end, Long ignoreId) {
        boolean overlaps = leaveRepository.findByEmployeeId(employeeId).stream()
                .filter(leave -> ignoreId == null || !ignoreId.equals(leave.getId()))
                .filter(leave -> leave.getStatus() == LeaveStatus.PENDING || leave.getStatus() == LeaveStatus.APPROVED)
                .anyMatch(leave -> datesOverlap(leave.getStartDate(), leave.getEndDate(), start, end));
        if (overlaps) {
            throw new InvalidLeaveRequestException(
                    HttpStatus.CONFLICT,
                    "This employee already has a pending or approved leave that overlaps those dates."
            );
        }
    }

    private boolean datesOverlap(LocalDate existingStart, LocalDate existingEnd, LocalDate start, LocalDate end) {
        return !existingEnd.isBefore(start) && !existingStart.isAfter(end);
    }

    private LeaveRequest toEntity(LeaveRequestDto request) {
        LeaveRequest leave = new LeaveRequest();
        leave.setEmployeeId(request.employeeId().trim());
        leave.setLeaveType(request.leaveType());
        leave.setStartDate(request.startDate());
        leave.setEndDate(request.endDate());
        leave.setReason(request.reason().trim());
        leave.setStatus(request.status());
        return leave;
    }

    private LeaveResponseDto toResponse(LeaveRequest leave) {
        return new LeaveResponseDto(
                leave.getId(),
                leave.getEmployeeId(),
                leave.getLeaveType(),
                leave.getStartDate(),
                leave.getEndDate(),
                leave.getReason(),
                leave.getStatus()
        );
    }
}
