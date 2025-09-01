// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/security/Pausable.sol";

/**
 * @title TokenVesting (Demo)
 * @notice Linear vesting with cliff and optional revoke.
 * - One schedule per beneficiary (simple & clear for demo)
 * - Tokens are pulled from the caller on createSchedule via safeTransferFrom
 * - Unvested tokens are returned to `treasury` on revoke
 */
contract TokenVesting is AccessControl, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    bytes32 public constant ADMIN_ROLE = DEFAULT_ADMIN_ROLE;

    struct Schedule {
        uint256 total;       // total tokens to vest
        uint256 released;    // tokens already released
        uint64 start;        // vesting start timestamp
        uint64 cliff;        // cliff duration (seconds)
        uint64 duration;     // total duration (seconds)
        bool revocable;      // can be revoked by admin
        bool revoked;        // has been revoked
        uint64 revokedAt;    // timestamp of revoke
    }

    IERC20 public immutable token;
    address public treasury;
    mapping(address => Schedule) private _schedules;

    event ScheduleCreated(address indexed beneficiary, uint256 total, uint64 start, uint64 cliff, uint64 duration, bool revocable);
    event TokensReleased(address indexed beneficiary, uint256 amount);
    event ScheduleRevoked(address indexed beneficiary, uint256 vestedPaid, uint256 refundToTreasury);

    error ScheduleExists();
    error NoSchedule();
    error NotRevocable();
    error AlreadyRevoked();
    error NothingToRelease();

    constructor(IERC20 token_, address admin, address treasury_) {
        require(address(token_) != address(0), "token=0");
        require(admin != address(0), "admin=0");
        require(treasury_ != address(0), "treasury=0");
        token = token_;
        treasury = treasury_;
        _grantRole(ADMIN_ROLE, admin);
    }

    function setTreasury(address newTreasury) external onlyRole(ADMIN_ROLE) {
        require(newTreasury != address(0), "treasury=0");
        treasury = newTreasury;
    }

    function getSchedule(address beneficiary) external view returns (Schedule memory) {
        Schedule memory s = _schedules[beneficiary];
        return s;
    }

    function hasSchedule(address beneficiary) public view returns (bool) {
        return _schedules[beneficiary].total > 0 || _schedules[beneficiary].revoked;
    }

    function createSchedule(
        address beneficiary,
        uint256 total,
        uint64 start,
        uint64 cliffDuration,
        uint64 duration,
        bool revocable
    ) external onlyRole(ADMIN_ROLE) whenNotPaused {
        Schedule storage s = _schedules[beneficiary];
        if (s.total != 0 && !s.revoked) revert ScheduleExists();
        require(duration > 0, "duration=0");
        require(cliffDuration <= duration, "cliff>duration");
        require(total > 0, "total=0");
        // Pull the tokens into the contract (requires allowance)
        token.safeTransferFrom(_msgSender(), address(this), total);

        _schedules[beneficiary] = Schedule({
            total: total,
            released: 0,
            start: start,
            cliff: cliffDuration,
            duration: duration,
            revocable: revocable,
            revoked: false,
            revokedAt: 0
        });

        emit ScheduleCreated(beneficiary, total, start, cliffDuration, duration, revocable);
    }

    function vestedAmount(address beneficiary, uint64 timestamp) public view returns (uint256) {
        Schedule memory s = _schedules[beneficiary];
        if (s.total == 0 && !s.revoked) {
            return 0;
        }
        uint64 effectiveTime = timestamp;
        if (s.revoked && s.revokedAt > 0 && timestamp > s.revokedAt) {
            effectiveTime = s.revokedAt;
        }
        if (effectiveTime < s.start + s.cliff) {
            return 0;
        }
        if (effectiveTime >= s.start + s.duration) {
            return s.total;
        }
        // linear vesting
        uint256 elapsed = uint256(effectiveTime - s.start);
        return (s.total * elapsed) / s.duration;
    }

    function releasable(address beneficiary) public view returns (uint256) {
        Schedule memory s = _schedules[beneficiary];
        if (s.total == 0 && !s.revoked) return 0;
        uint256 vested = vestedAmount(beneficiary, uint64(block.timestamp));
        if (vested <= s.released) return 0;
        return vested - s.released;
    }

    function release() external nonReentrant whenNotPaused {
        _releaseTo(_msgSender());
    }

    function releaseFor(address beneficiary) external onlyRole(ADMIN_ROLE) nonReentrant whenNotPaused {
        _releaseTo(beneficiary);
    }

    function _releaseTo(address beneficiary) internal {
        Schedule storage s = _schedules[beneficiary];
        if (s.total == 0 && !s.revoked) revert NoSchedule();
        uint256 amount = releasable(beneficiary);
        if (amount == 0) revert NothingToRelease();
        s.released += amount;
        token.safeTransfer(beneficiary, amount);
        emit TokensReleased(beneficiary, amount);
    }

    function revoke(address beneficiary) external onlyRole(ADMIN_ROLE) nonReentrant whenNotPaused {
        Schedule storage s = _schedules[beneficiary];
        if (s.total == 0 && !s.revoked) revert NoSchedule();
        if (!s.revocable) revert NotRevocable();
        if (s.revoked) revert AlreadyRevoked();

        s.revoked = true;
        s.revokedAt = uint64(block.timestamp);

        uint256 vested = vestedAmount(beneficiary, s.revokedAt);
        uint256 unreleased = 0;
        if (vested > s.released) {
            unreleased = vested - s.released;
            s.released = vested;
            token.safeTransfer(beneficiary, unreleased);
        }

        uint256 refund = s.total - vested;
        if (refund > 0) {
            token.safeTransfer(treasury, refund);
        }

        emit ScheduleRevoked(beneficiary, unreleased, refund);
    }

    function pause() external onlyRole(ADMIN_ROLE) { _pause(); }
    function unpause() external onlyRole(ADMIN_ROLE) { _unpause(); }
}
