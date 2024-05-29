import jwt from 'jsonwebtoken';
import { userDataClient } from '../utils/prisma/index.js';

//사용자 인증 미들웨어
export default async function (req, res, next) {
    try { //1. 쿠키를 가져온다
        const { authorization } = req.cookies;

        if (!authorization) {
            throw new Error('인증 토큰이 없습니다.');
        }
        //2. 베어러 토큰 형식인지 확인 + 배열 구조분의 할당!
        const [tokenType, token] = authorization.split(' ');
        if (tokenType !== 'Bearer') throw new Error('토큰 타입이 일치하지 않습니다.');
        //3. 서버에서 발급한 **JWT가 맞는지 검증합니다.
        const decodedToken = jwt.verify(token, 'customized_secret_key');
        const accountId = decodedToken.accountId;
        //4. JWT의 'userId'기반으로 사용자 조회
        const account = await userDataClient.account.findFirst({
            where: { accountId: +accountId },
        })
        //4-1. user 탐색 실패시
        if (!account) {
            res.clearCookie('authorization');
            throw new Error('토큰 사용자가 존재하지 않습니다.');
        }
        //5. 'req.user'에 조회된 사용자 정보를 할당
        req.account = account;
        //6. 다음 미들웨어 실행.
        next();
    }
    catch (error) {
        res.clearCookie('authorization');
        switch (error.name) {
            case 'TokenExpiredError'://토큰 만료시
                return res.status(401).json({ message: '토큰이 만료되었습니다.' });
            case 'JsonWebTokenError'://토큰 검증 실패시
                return res.status(401).json({ message: '토큰인증에 실패하셨습니다.' });
            default:
                return res.status(401).json({ message: error.message ?? '비 정상적인 요청입니다.' });
        }
    }
}